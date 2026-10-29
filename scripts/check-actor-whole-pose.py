"""Check saved full-body images without treating topology as motion approval."""
import argparse
from collections import deque
import hashlib
import io
import json
import shutil
import subprocess
import zipfile
from pathlib import Path
from xml.etree.ElementTree import fromstring

import numpy as np
from PIL import Image, ImageDraw

from actor_whole_pose import WholePoseArt

ROOT = Path(__file__).resolve().parents[1]


def ora_layers(path):
    with zipfile.ZipFile(path) as archive:
        root = fromstring(archive.read('stack.xml'))
        result=[]
        for node in reversed(list(root.find('stack'))):
            image=Image.new('RGBA',(int(root.get('w')),int(root.get('h'))))
            if node.get('visibility','visible')!='hidden':
                part=Image.open(io.BytesIO(archive.read(node.get('src')))).convert('RGBA')
                opacity=float(node.get('opacity','1'))
                if opacity!=1:part.putalpha(part.getchannel('A').point(lambda a:round(a*opacity)))
                image.alpha_composite(part,(int(node.get('x','0')),int(node.get('y','0'))))
            result.append((node.get('name'),image))
        return result


def component(mask, seed):
    result = np.zeros_like(mask, dtype=bool)
    x,y = seed
    if not mask[y,x]:
        raise ValueError('Diagnostic head seed is not in the rendered head')
    todo=deque([(x,y)]);result[y,x]=True
    while todo:
        x,y=todo.popleft()
        for dy in [-1,0,1]:
            for dx in [-1,0,1]:
                xx,yy=x+dx,y+dy
                if 0<=xx<mask.shape[1] and 0<=yy<mask.shape[0] and mask[yy,xx] and not result[yy,xx]:
                    result[yy,xx]=True;todo.append((xx,yy))
    return result


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory',type=Path)
    args=parser.parse_args();out=args.directory.resolve()
    spec=json.loads((out/'motion.spec.json').read_text(encoding='utf-8'))
    motion=json.loads((out/'motion.json').read_text(encoding='utf-8'))
    ox,oy=spec['sourceOffset'];size=tuple(spec['canvas'])
    layers={p.stem:Image.open(p).convert('RGBA') for p in (ROOT/spec['layerSource']).glob('*.png')}
    art=WholePoseArt(layers,size,(ox,oy))
    neutral,_=art.render({'upperShift':[0,0],'bodyPose':{}})
    neutral_image=Image.new('RGBA',size)
    for _,im in neutral:neutral_image.alpha_composite(im)
    reference=Image.new('RGBA',size)
    source=Image.new('RGBA',(156,348))
    for name in ['arm_R','arm_L','upper_body','toolbox_R','glove_R','recorder_L']:source.alpha_composite(layers[name])
    reference.alpha_composite(source,(ox,oy))
    neutral_same=neutral_image.tobytes()==reference.tobytes()
    if not neutral_same:raise ValueError('Neutral reconstruction changed source artwork')
    atlas=Image.open(out/motion['atlas']).convert('RGBA')
    checks=[];upper_hashes=set();head_boxes=[]
    for record in motion['frames']:
        frame=record['frame'];im=Image.open(out/record['file']).convert('RGBA')
        x,y,w,h=record['atlas']
        if atlas.crop((x,y,x+w,y+h)).tobytes()!=im.tobytes():
            raise ValueError('Atlas does not contain the actual saved pose: '+str(frame))
        saved_layers=ora_layers(out/f'frame-{frame:03}.ora')
        body_layer=next(layer for name,layer in saved_layers if name=='continuous_body_head_neck')
        hx,hy=record['upperPose']['head']
        tx,ty=round(hx-74),round(hy-30)
        head_crop=body_layer.crop((ox+50+tx,oy+ty,ox+105+tx,oy+60+ty))
        # Source masks keep arbitrary RGB under alpha=0. Compare the actual
        # rendered RGBA, not invisible colors outside the face silhouette.
        expected_head=Image.new('RGBA',(55,60))
        expected_head.alpha_composite(layers['upper_body'].crop((50,0,105,60)))
        actual_head=Image.new('RGBA',(55,60));actual_head.alpha_composite(head_crop)
        if actual_head.tobytes()!=expected_head.tobytes():
            raise ValueError('Visible face samples differ after translation: '+str(frame))
        merged=Image.new('RGBA',size);actor=Image.new('RGBA',size)
        for name,layer in saved_layers:
            merged.alpha_composite(layer)
            if name!='ground_contact':actor.alpha_composite(layer)
        if merged.tobytes()!=im.tobytes():raise ValueError('Saved pose layers do not reproduce image')
        seed=[round(v+d) for v,d in zip(record['upperPose']['head'],[ox,oy])]
        connected=component(np.array(actor.getchannel('A'))>0,seed)
        attached={}
        for name,layer in saved_layers:
            if name in ['boot_R','boot_L','toolbox_R','recorder_L']:
                mask=np.array(layer.getchannel('A'))>0
                ratio=float(connected[mask].mean())
                attached[name]=ratio
                if ratio<.95:raise ValueError(f'Detached saved artwork {frame} {name}: {ratio}')
        # Only the shoulder / upper-sleeve seam. The source's wrist-coat gap
        # and bent-arm opening are intentional negative space, not defects.
        seam=actor.getchannel('A').crop((ox+2,oy+66,ox+74,oy+140)).point(lambda v:255 if v else 0)
        sw,sh=seam.size
        for point in ([(u,0) for u in range(sw)]+[(u,sh-1) for u in range(sw)]
                      +[(0,v) for v in range(sh)]+[(sw-1,v) for v in range(sh)]):
            if seam.getpixel(point)==0:ImageDraw.floodfill(seam,point,128)
        holes=sum(p==0 for p in seam.get_flattened_data())
        if holes:raise ValueError(f'Enclosed shoulder seam: {frame} / {holes} pixels')
        upper_hashes.add(hashlib.sha256(im.crop((0,0,size[0],oy+178)).tobytes()).hexdigest())
        head=actor.getchannel('A').crop((ox+15,oy-8,ox+110,oy+58)).getbbox()
        head_boxes.append(head)
        checks.append({'frame':frame,'savedOraMatchesPng':True,'atlasMatchesPng':True,
                       'facePixelsPreservedAfterTranslation':True,
                       'shoulderSeamHoles':holes,'connectedArtworkFractions':attached})
    if len(upper_hashes)<4:raise ValueError('The rendered upper body is frozen across the short clip')
    if len(set(head_boxes))<2:raise ValueError('The actual rendered head never moves')
    hold=[Image.open(out/'video-frames'/f'{i:03}.png').tobytes()
          for i in range(16,len(motion['previewOrder']))]
    if len(set(hold))!=1:raise ValueError('Final held pose changes')
    probe=shutil.which('ffprobe')
    media=None
    if probe:
        result=subprocess.run([probe,'-v','error','-select_streams','v:0','-show_entries',
            'stream=codec_name,width,height,nb_frames,r_frame_rate:format=duration','-of','json',str(out/motion['video'])],
            capture_output=True,text=True,check=True)
        media=json.loads(result.stdout)
    result={'neutralUpperReconstructionPixelIdentical':neutral_same,'framesChecked':len(checks),
            'actualUpperFrameCount':len(upper_hashes),'actualHeadBoundingBoxCount':len(set(head_boxes)),
            'allSavedOraAndAtlasFramesVerified':True,'finalHoldPixelIdentical':True,
            'sourceOwnershipTransferPixelCount':sum(len(x['pixels']) for x in art.ownership_transfers),
            'checks':checks,'media':media,
            'checksProveAnatomyOrNaturalMotion':False,'artApproved':False,'walkingApproved':False}
    (out/'whole-pose-checks.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({k:v for k,v in result.items() if k not in ['checks','media']},ensure_ascii=False))


if __name__=='__main__':main()
