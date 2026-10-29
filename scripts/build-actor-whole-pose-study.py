"""Build one finite loaded weight transfer from explicitly authored phases.

The legs use authored intermediate knee/ankle controls, connected silhouette
width templates and explicit contact phases. No rejected endpoint centerline
animation or custom FK is loaded. This is not a looping locomotion asset.
"""
import argparse
import copy
import hashlib
import io
import json
import math
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path
from xml.etree.ElementTree import fromstring

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from actor_pose_review import write_review_sheet
from actor_whole_pose import rotate, WholePoseArt

ROOT = Path(__file__).resolve().parents[1]

# Each row: right knee x/y, right ankle x/y/angle, left knee x/y,
# left ankle x/y/angle. None of the intermediate knee paths is inferred from
# the old crossing contours. Contact ankles are resolved from fixed anchors.
POSE_ROWS = [
    [55,253,58,319,0, 95,258,103,325,-14],
    [55,253,58,319,0, 93,255,102,324,-19],
    [55,253,58,319,0, 89,251,102,317,-14],
    [56,253,58,319,0, 85,247,101,309,-6],
    [56,253,58,319,0, 83,246,101,304,0],
    [55,253,58,318,-3, 81,247,96,305,6],
    [54,253,57,317,-6, 80,249,91,310,9],
    [52,252,55,315,-9, 80,251,85,317,10],
    [50,252,54,314,-12, 82,254,81,323,8],
    [50,250,52,312,-18, 82,255,80,324,3],
    [50,248,52,309,-20, 82,256,79,324,0],
    [50,247,55,308,-20, 82,257,79,324,0],
    [51,247,58,307,-20, 82,257,79,324,0],
]
STATIONS = [0, .2, .4, .5, .62, .8, 1]


def lerp(a, b, t):
    return a + (b-a)*t


def center(spec, y):
    return float(np.interp(y, [p[0] for p in spec['center']], [p[1] for p in spec['center']]))


def sample_outline(spec, station):
    top, knee, cuff = spec['center'][0][0], spec['kneeY'], spec['center'][-1][0]
    y = lerp(top, knee, station*2) if station <= .5 else lerp(knee, cuff, (station-.5)*2)
    mask = Image.new('L', (156, 348))
    ImageDraw.Draw(mask).polygon([tuple(p) for p in spec['outline']], fill=255)
    xs = [x for x in range(mask.width) if mask.getpixel((x, round(y)))]
    if not xs:
        raise ValueError('Missing authored silhouette station')
    line = lerp(spec['center'][0][1], center(spec, knee), station*2) if station <= .5 else lerp(center(spec, knee), spec['center'][-1][1], (station-.5)*2)
    return max(xs)-min(xs)+1, center(spec, y)-line


def leg(first, second, t, side, hip, knee, ankle, angle):
    pivot = [58, 319] if side == 'R' else [104, 328]
    cuff = np.array(ankle) + rotate([0, -5 if side == 'R' else -7], angle)
    rows, widths = [], []
    for station in STATIONS:
        y = lerp(hip[1], knee[1], station*2) if station <= .5 else lerp(knee[1], cuff[1], (station-.5)*2)
        x = lerp(hip[0], knee[0], station*2) if station <= .5 else lerp(knee[0], cuff[0], (station-.5)*2)
        wa, oa = sample_outline(first, station)
        wb, ob = sample_outline(second, station)
        # End anchors stay on the actual hip, knee and shoe cuff.
        residual = 0 if station in [0, .5, 1] else lerp(oa, ob, t)
        rows.append([float(y), float(x+residual)])
        widths.append(lerp(wa, wb, t))
    outline = [[round(x-w/2), round(y)] for (y, x), w in zip(rows, widths)]
    outline += [[round(x+w/2), round(y)] for (y, x), w in reversed(list(zip(rows, widths))) ]
    return {'center': rows, 'outline': outline, 'kneeY': knee[1],
            'ankle': [float(v) for v in ankle], 'bootAngle': angle}


def solve_contact(side, angle, patch, anchor):
    pivot = np.array([58,319] if side == 'R' else [104,328])
    return np.array(anchor)-rotate(np.array(patch)-pivot, angle)


def read_ora_layer(path, name):
    with zipfile.ZipFile(path) as archive:
        root = fromstring(archive.read('stack.xml'))
        node = next(n for n in root.find('stack') if n.get('name') == name)
        result = Image.new('RGBA', (int(root.get('w')), int(root.get('h'))))
        if node.get('visibility','visible') == 'hidden':
            return result
        image = Image.open(io.BytesIO(archive.read(node.get('src')))).convert('RGBA')
        opacity = float(node.get('opacity','1'))
        if opacity != 1:
            image.putalpha(image.getchannel('A').point(lambda a:round(a*opacity)))
        result.alpha_composite(image,(int(node.get('x','0')),int(node.get('y','0'))))
        return result


def author_study(keypose_path, out):
    source = json.loads(keypose_path.read_text(encoding='utf-8'))
    keys = source['poses']
    if len(keys) != 4 or not all(p.get('bodyPose') for p in keys):
        raise ValueError('Review four whole-body key poses before building this transition')
    recipe = copy.deepcopy(source)
    recipe['version'] = 'whole-pose-transfer01-internal-motion'
    recipe['reviewColumns'] = 4
    recipe['method'] = __doc__
    recipe['poses'] = []
    contacts, phases = [], []
    labels = ['右脚承重，左脚离地', '左腿前摆', '左脚跟落地', '换到左腿承重']
    for frame, values in enumerate(POSE_ROWS):
        segment = min(frame//4, 2)
        t = (frame-segment*4)/4
        a, b = keys[segment], keys[segment+1]
        dx, dy = [lerp(a['upperShift'][i], b['upperShift'][i], t) for i in range(2)]
        controls = {name: lerp(a['bodyPose'].get(name, 0), b['bodyPose'].get(name, 0), t)
                    for name in set(a['bodyPose']) | set(b['bodyPose'])}
        rx, ry, rax, ray, ra, lx, ly, lax, lay, la = values
        ankle_r, ankle_l = np.array([rax,ray], dtype=float), np.array([lax,lay], dtype=float)
        active = {}
        if frame <= 9:
            active['R'] = {'patch': [30,337], 'anchor': [30,337], 'kind': 'full' if frame<=4 else 'toe'}
            ankle_r = solve_contact('R', ra, active['R']['patch'], active['R']['anchor'])
        if frame <= 1:
            active['L'] = {'patch': [89,347], 'anchor': [93.04,347.07], 'kind': 'toe'}
            ankle_l = solve_contact('L', la, active['L']['patch'], active['L']['anchor'])
        elif frame >= 8:
            active['L'] = {'patch': [114,346], 'anchor': [88.4,342.22], 'kind': 'heel' if frame<10 else 'full'}
            ankle_l = solve_contact('L', la, active['L']['patch'], active['L']['anchor'])
        pose = {'name': f'frame-{frame:03}', 'label': f'{frame+1:02} / 13',
                'support': labels[min(frame//4,3)], 'upperShift': [dx,dy],
                'bodyPose': controls, 'upperAngle': 0, 'shadows': [], 'legOrder': ['R','L']}
        pose['R'] = leg(a['R'],b['R'],t,'R',[62+dx,180+dy],[rx,ry],ankle_r,ra)
        pose['L'] = leg(a['L'],b['L'],t,'L',[98+dx,180+dy],[lx,ly],ankle_l,la)
        for side, contact in active.items():
            x,y = contact['anchor']
            if contact['kind'] == 'full':
                if side == 'R': x += 18
                else: x -= 10; y += 1
            width = (36 if side=='R' else 24) if contact['kind']=='full' else 9
            pose['shadows'].append([x,y+.6,width])
        recipe['poses'].append(pose)
        contacts.append(active)
        phases.append(labels[min(frame//4,3)])
    out.mkdir(parents=True)
    recipe_path = out/'motion.spec.json'
    recipe_path.write_text(json.dumps(recipe,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    subprocess.run([sys.executable,'-X','utf8',str(ROOT/'scripts/author-actor-contour-poses.py'),
                    '--recipe',str(recipe_path),'--out-dir',str(out)],cwd=ROOT,check=True)
    generated = json.loads((out/'authoring.json').read_text(encoding='utf-8'))
    return recipe, generated, contacts, phases


def package_media(out, recipe, generated, contacts, phases, ffmpeg):
    ox, oy = recipe['sourceOffset']
    patch_checks = []
    for frame, (pose, active) in enumerate(zip(recipe['poses'],contacts)):
        for side, contact in active.items():
            shoe = read_ora_layer(out/(pose['name']+'.ora'),'boot_'+side)
            px,py = [round(v+w) for v,w in zip(contact['anchor'],[ox,oy])]
            opaque = shoe.getchannel('A').crop((px-1,py-1,px+2,py+2)).getextrema()[1]>200
            if not opaque:
                raise ValueError(f'Lost actual contact patch: {frame} {side}')
            patch_checks.append({'frame':frame,'side':side,**contact,'actualPatchOpaque':True})
    video = out/'video-frames';video.mkdir()
    font = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',20)
    small = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',15)
    atlas = Image.new('RGBA',(260*4,400*4))
    order = [0]*3 + list(range(13)) + [12]*9
    for frame, pose in enumerate(recipe['poses']):
        im=Image.open(out/(pose['name']+'.png')).convert('RGBA')
        atlas.alpha_composite(im,((frame%4)*260,(frame//4)*400))
    atlas.save(out/'motion-atlas.png')
    for i,frame in enumerate(order):
        im=Image.open(out/(recipe['poses'][frame]['name']+'.png')).convert('RGBA')
        page=Image.new('RGB',(900,900),'#e1e5d7');draw=ImageDraw.Draw(page)
        draw.text((24,16),'负重换步 · 全身连续小样',font=font,fill='#244238')
        draw.text((24,48),f'{phases[frame]}  ·  {frame+1:02} / 13  ·  制作试验',font=small,fill='#536855')
        page.paste(im,(25,100),im)
        close=im.crop((ox-8,oy-8,ox+172,oy+356)).resize((360,728),Image.Resampling.NEAREST)
        page.paste(close,(470,100),close)
        scene=im.resize((78,120),Image.Resampling.NEAREST);page.paste(scene,(120,610),scene)
        draw.text((24,530),'原尺寸完整人物',font=small,fill='#536855')
        draw.text((24,755),'约 104px 场景尺寸',font=small,fill='#536855')
        draw.text((470,77),'完整人物 · 整数 2 倍',font=small,fill='#536855')
        draw.text((24,860),'单次换重片段 · 无循环 / 转身 / 场景行进验收',font=small,fill='#536855')
        page.save(video/f'{i:03}.png')
    subprocess.run([ffmpeg,'-hide_banner','-loglevel','error','-framerate','10','-i',str(video/'%03d.png'),
                    '-c:v','libx264','-crf','12','-pix_fmt','yuv420p','-movflags','+faststart',str(out/'whole-pose.mp4')],check=True)
    key_out = out/'keyframes';key_out.mkdir()
    for frame in [0,4,8,12]:
        shutil.copyfile(out/(recipe['poses'][frame]['name']+'.png'),key_out/(recipe['poses'][frame]['name']+'.png'))
    reference=Image.open(out/'source-reference.png').convert('RGBA')
    write_review_sheet(key_out,reference,[recipe['poses'][f] for f in [0,4,8,12]],recipe['canvas'],5)
    manifest = {'version':recipe['version'],'fps':10,'frames':[{'frame':i,'file':p['name']+'.png',
                 'atlas':[i%4*260,i//4*400,260,400],'phase':phases[i],
                 'upperPose':generated['poses'][i]['upperPose'],'contacts':contacts[i]} for i,p in enumerate(recipe['poses'])],
                'canvas':recipe['canvas'],'atlas':'motion-atlas.png','video':'whole-pose.mp4',
                'frameCount':13,'previewOrder':order,'sourceSha256':recipe['sourceSha256'],
                'contactPatchChecks':patch_checks,'contactChecksProveAnatomy':False,
                'artApproved':False,'walkingApproved':False,'homepageIntegrated':False,
                'limitations':['Short weight transfer, not a walking cycle or route.',
                               'Authored controls with sampled source cloth, not complete repainted animation.',
                               'Single view. No multi-view sole-plane or dynamic balance approval.']}
    (out/'motion.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'output':str(out),'frames':13,'contactSamples':len(patch_checks),'video':'whole-pose.mp4'},ensure_ascii=False))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--keyposes', type=Path)
    mode.add_argument('--repack-source', type=Path, help='Original motion directory, after full-pose paint reimport into out-dir')
    parser.add_argument('--out-dir', type=Path, required=True)
    args = parser.parse_args()
    out = args.out_dir.resolve()
    ffmpeg = shutil.which('ffmpeg')
    if not ffmpeg:
        raise RuntimeError('ffmpeg is required for the finite review clip')
    if args.keyposes:
        if out.exists():
            raise ValueError('Use a new version directory; preserve saved paint sources')
        recipe, generated, contacts, phases = author_study(args.keyposes, out)
    else:
        parent = args.repack_source.resolve()
        recipe_path = parent/'motion.spec.json'
        recipe = json.loads(recipe_path.read_text(encoding='utf-8'))
        original_motion = json.loads((parent/'motion.json').read_text(encoding='utf-8'))
        generated = json.loads((out/'authoring.json').read_text(encoding='utf-8'))
        if generated['recipeSha256'] != hashlib.sha256(recipe_path.read_bytes()).hexdigest():
            raise ValueError('STALE_BASE: painted poses and motion recipe no longer match')
        if [p['pose'] for p in generated['poses']] != [p['name'] for p in recipe['poses']]:
            raise ValueError('Repack must include the complete reviewed frame set')
        for pose in generated['poses']:
            image = Image.open(out/pose['png']).convert('RGBA')
            if hashlib.sha256(image.tobytes()).hexdigest() != pose['baseRgbaSha256']:
                raise ValueError('Reimport saved pose paint before repacking edited images')
        if any((out/name).exists() for name in ['motion.json','motion-atlas.png','whole-pose.mp4','video-frames','keyframes']):
            raise ValueError('Preserve previous media; reimport paint into a new directory')
        contacts = [frame['contacts'] for frame in original_motion['frames']]
        phases = [frame['phase'] for frame in original_motion['frames']]
        shutil.copyfile(recipe_path, out/'motion.spec.json')
        for name in ['working-upper.ora','working-cloth.ora','source-layer-preparation.json']:
            if (parent/name).exists():
                shutil.copyfile(parent/name,out/name)
    package_media(out, recipe, generated, contacts, phases, ffmpeg)


if __name__=='__main__':
    main()
