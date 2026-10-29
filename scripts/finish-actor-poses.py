"""Keep pose-local pixel retouches separate from a shared painted actor master.

--prepare creates editable ORA paint layers against frozen rig renders.
Without --prepare, reimport those layers and export final RGBA poses.
Reject stale base renders rather than applying an old paint patch to a new pose.
"""
import argparse
import hashlib
import io
import json
import sys
import zipfile
from pathlib import Path
from xml.etree.ElementTree import Element, SubElement, fromstring, tostring

from PIL import Image, ImageChops, ImageDraw

sys.stdout.reconfigure(encoding='utf-8')

def rgba_hash(image):
    return hashlib.sha256(image.convert('RGBA').tobytes()).hexdigest()

def png_bytes(image):
    stream = io.BytesIO(); image.save(stream, format='PNG'); return stream.getvalue()

def write_ora(path, size, layers):
    root = Element('image', {'w':str(size[0]), 'h':str(size[1]), 'version':'0.0.3', 'name':path.stem})
    stack = SubElement(root, 'stack')
    merged = Image.new('RGBA', size)
    for name, image in layers:
        merged.alpha_composite(image)
    with zipfile.ZipFile(path,'w') as archive:
        archive.writestr('mimetype','image/openraster',compress_type=zipfile.ZIP_STORED)
        for index,(name,image) in reversed(list(enumerate(layers))):
            source='data/layer-%02d.png'%index
            archive.writestr(source,png_bytes(image))
            SubElement(stack,'layer',{'name':name,'src':source,'x':'0','y':'0','opacity':'1',
                'visibility':'visible','composite-op':'svg:src-over'})
        archive.writestr('stack.xml',tostring(root,encoding='utf-8'))
        archive.writestr('mergedimage.png',png_bytes(merged))

def read_ora(path, expected_size):
    layers=[]
    with zipfile.ZipFile(path) as archive:
        root=fromstring(archive.read('stack.xml'))
        if (int(root.attrib['w']),int(root.attrib['h'])) != expected_size:
            raise ValueError('Pose paint canvas changed: '+path.name)
        stack=root.find('stack')
        if stack is None or any(node.tag!='layer' for node in stack):
            raise ValueError('Keep a flat normal-blend paint stack')
        for node in reversed(list(stack)):
            if node.get('composite-op','svg:src-over')!='svg:src-over':
                raise ValueError('Rasterize non-normal blend modes')
            image=Image.open(io.BytesIO(archive.read(node.attrib['src']))).convert('RGBA')
            full=Image.new('RGBA',expected_size)
            full.alpha_composite(image,(int(node.get('x','0')),int(node.get('y','0'))))
            if float(node.get('opacity','1'))!=1:
                raise ValueError('Use pixel alpha within full-opacity layers')
            if node.get('visibility','visible')!='visible':
                raise ValueError('Keep exported layers visible')
            layers.append((node.get('name',''),full))
    if not layers or layers[0][0]!='base_render':
        raise ValueError('Keep base_render as the bottom layer')
    return layers

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--recipe',type=Path,required=True)
    parser.add_argument('--prepare',action='store_true')
    args=parser.parse_args()
    recipe_path=args.recipe.resolve(); directory=recipe_path.parent
    recipe=json.loads(recipe_path.read_text(encoding='utf-8')); size=tuple(recipe['canvas'])
    tag=recipe['tag']; corr=directory/recipe['correctionsDirectory']; final=directory/recipe['finalDirectory']
    meta_path=corr/(tag+'-paint-inputs.json')
    recipe_sha=hashlib.sha256(recipe_path.read_bytes()).hexdigest()
    if args.prepare:
        if meta_path.exists() or any((corr/(p['name']+'.ora')).exists() for p in recipe['poses']):
            raise ValueError('Paint sources already exist; create a new version instead of overwriting edits')
        corr.mkdir(parents=True,exist_ok=True)
        meta={'tag':tag,'recipeSha256':recipe_sha,'method':recipe['method'],'poses':[]}
        for pose in recipe['poses']:
            base=Image.open(directory/pose['baseFile']).convert('RGBA')
            if base.size!=size:raise ValueError('Rig render canvas mismatch')
            item={'name':pose['name'],'baseFile':pose['baseFile'],'baseRgbaSha256':rgba_hash(base),'ora':None}
            if pose['operations']:
                paint={}
                for op in pose['operations']:
                    layer=paint.setdefault(op['layer'],Image.new('RGBA',size))
                    color=tuple(op['color']) if isinstance(op['color'],list) else op['color']
                    ImageDraw.Draw(layer).polygon([tuple(p) for p in op['polygon']],fill=color)
                opaque=base.getchannel('A').point(lambda v:255 if v==255 else 0)
                clip=Image.new('L',size); box=pose['clipBox']
                ImageDraw.Draw(clip).rectangle((box[0],box[1],box[2]-1,box[3]-1),fill=255)
                for layer in paint.values():
                    layer.putalpha(ImageChops.multiply(layer.getchannel('A'),ImageChops.multiply(opaque,clip)))
                item['ora']=pose['name']+'.ora'
                write_ora(corr/item['ora'],size,[('base_render',base)]+list(paint.items()))
            meta['poses'].append(item)
        meta_path.write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        print(json.dumps({'prepared':str(meta_path),'editablePoses':sum(bool(p['ora']) for p in meta['poses'])}))
        return
    meta=json.loads(meta_path.read_text(encoding='utf-8'))
    if meta['recipeSha256']!=recipe_sha:raise ValueError('Recipe changed; create new versioned paint inputs')
    exports=[]
    for item in meta['poses']:
        base=Image.open(directory/item['baseFile']).convert('RGBA')
        if base.size!=size or rgba_hash(base)!=item['baseRgbaSha256']:
            raise ValueError('STALE_BASE: rig render changed for '+item['name']+'; review and rebase paint layers')
        output=base.copy(); layer_names=[]
        if item['ora']:
            layers=read_ora(corr/item['ora'],size)
            if rgba_hash(layers[0][1])!=item['baseRgbaSha256']:
                raise ValueError('Archived base_render was modified; edit only correction layers')
            for name,layer in layers[1:]:
                output.alpha_composite(layer);layer_names.append(name)
        difference=ImageChops.difference(base,output)
        if difference.getchannel('A').getbbox():raise ValueError('This retouch contract preserves the source silhouette alpha')
        pose_recipe=next(p for p in recipe['poses'] if p['name']==item['name'])
        bounds=difference.getbbox(alpha_only=False)
        if bounds:
            allowed=pose_recipe.get('clipBox')
            if not allowed or not(bounds[0]>=allowed[0] and bounds[1]>=allowed[1] and bounds[2]<=allowed[2] and bounds[3]<=allowed[3]):
                raise ValueError('Paint changes extend beyond the reviewed pose-local region')
        exports.append((output,{'name':item['name'],'file':tag+'-'+item['name']+'.png',
            'baseRgbaSha256':item['baseRgbaSha256'],'finalRgbaSha256':rgba_hash(output),
            'changedBounds':list(bounds) if bounds else None,
            'changedPixels':sum(any(p) for p in difference.get_flattened_data()),
            'silhouetteAlphaPreserved':True,'correctionLayers':layer_names,
            'paintSource':item['ora'],'paintSourceSha256':hashlib.sha256((corr/item['ora']).read_bytes()).hexdigest() if item['ora'] else None}))
    # Validate all dependencies before writing any final pose.
    final.mkdir(parents=True,exist_ok=True)
    for image,item in exports:image.save(final/item['file'])
    result={'tag':tag,'method':recipe['method'],'poses':[p for image,p in exports],
        'paintInputs':'../'+recipe['correctionsDirectory']+'/'+meta_path.name,
        'artApproved':False,'walkCycleValidated':False,'homepageIntegrated':False}
    (final/(tag+'-finish.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(result,ensure_ascii=False))

if __name__=='__main__':main()
