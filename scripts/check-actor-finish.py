"""Exercise actual ORA editing, cropped layer imports and stale-base rejection.

Uses isolated copies, invokes the real exporter and compares exported RGBA.
No test paint enters the delivered character artwork.
"""
import argparse
import hashlib
import io
import json
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path
from xml.etree.ElementTree import fromstring, tostring

from PIL import Image, ImageChops

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--recipe',type=Path,required=True)
args=parser.parse_args()
recipe_path=args.recipe.resolve(); source=recipe_path.parent
recipe=json.loads(recipe_path.read_text(encoding='utf-8'))
lab=ROOT/'.lab/actor-layer-study';lab.mkdir(exist_ok=True,parents=True)
work=Path(tempfile.mkdtemp(prefix='finish-validation-',dir=lab))
shutil.copy2(recipe_path,work/recipe_path.name)
for pose in recipe['poses']:shutil.copy2(source/pose['baseFile'],work/pose['baseFile'])
shutil.copytree(source/recipe['correctionsDirectory'],work/recipe['correctionsDirectory'])
command=[sys.executable,str(ROOT/'scripts/finish-actor-poses.py'),'--recipe',str(work/recipe_path.name)]

def export(expect_error=None):
    result=subprocess.run(command,capture_output=True,text=True,encoding='utf-8')
    if expect_error:
        assert result.returncode!=0 and expect_error in result.stderr,result.stderr
    else:
        assert result.returncode==0,result.stderr

def same_pixels(a,b):
    return ImageChops.difference(Image.open(a).convert('RGBA'),Image.open(b).convert('RGBA')).getbbox(alpha_only=False) is None

def output(pose):
    return work/recipe['finalDirectory']/(recipe['tag']+'-'+pose+'.png')

def mutate_ora(path,operation):
    with zipfile.ZipFile(path) as archive:contents={n:archive.read(n) for n in archive.namelist()}
    root=fromstring(contents['stack.xml'])
    operation(root,contents)
    contents['stack.xml']=tostring(root,encoding='utf-8')
    with zipfile.ZipFile(path,'w') as archive:
        for name,data in contents.items():archive.writestr(name,data)

def encode(image):
    stream=io.BytesIO();image.save(stream,format='PNG');return stream.getvalue()

export()
for pose in recipe['poses']:
    assert same_pixels(output(pose['name']),source/recipe['finalDirectory']/output(pose['name']).name)
selected=next(p for p in recipe['poses'] if p['operations'])
ora=work/recipe['correctionsDirectory']/(selected['name']+'.ora')

def crop_layers(root,contents):
    for node in root.findall('.//layer'):
        image=Image.open(io.BytesIO(contents[node.attrib['src']])).convert('RGBA')
        box=image.getbbox()
        if box:
            contents[node.attrib['src']]=encode(image.crop(box))
            node.set('x',str(int(node.get('x','0'))+box[0]));node.set('y',str(int(node.get('y','0'))+box[1]))

mutate_ora(ora,crop_layers)
export()
for pose in recipe['poses']:
    assert same_pixels(output(pose['name']),source/recipe['finalDirectory']/output(pose['name']).name)

def edit_paint(root,contents):
    node=next(n for n in root.findall('.//layer') if n.get('name')=='compression_folds')
    image=Image.open(io.BytesIO(contents[node.attrib['src']])).convert('RGBA')
    x,y=114-int(node.get('x','0')),286-int(node.get('y','0'))
    r,g,b,a=image.getpixel((x,y));assert a==255
    image.putpixel((x,y),(r+3,g,b,a));contents[node.attrib['src']]=encode(image)

mutate_ora(ora,edit_paint)
export()
for pose in recipe['poses']:
    reference=source/recipe['finalDirectory']/output(pose['name']).name
    if pose['name']==selected['name']:
        diff=ImageChops.difference(Image.open(output(pose['name'])),Image.open(reference))
        assert diff.getbbox(alpha_only=False)==(114,286,115,287)
    else:assert same_pixels(output(pose['name']),reference)
saved_output_hashes={p['name']:hashlib.sha256(output(p['name']).read_bytes()).hexdigest() for p in recipe['poses']}
base=work/selected['baseFile']; image=Image.open(base).convert('RGBA')
image.putpixel((110,282),(0,0,0,255));image.save(base)
export('STALE_BASE')
for name,digest in saved_output_hashes.items():assert hashlib.sha256(output(name).read_bytes()).hexdigest()==digest
shutil.copy2(source/selected['baseFile'],base)

def edit_archived_base(root,contents):
    node=next(n for n in root.findall('.//layer') if n.get('name')=='base_render')
    image=Image.open(io.BytesIO(contents[node.attrib['src']])).convert('RGBA')
    image.putpixel((110-int(node.get('x','0')),282-int(node.get('y','0'))),(0,0,0,255))
    contents[node.attrib['src']]=encode(image)

mutate_ora(ora,edit_archived_base)
export('Archived base_render was modified')
for name,digest in saved_output_hashes.items():assert hashlib.sha256(output(name).read_bytes()).hexdigest()==digest
report={'scope':'Real isolated edit/import/export checks, not visual approval',
    'unmodifiedExportsMatch':True,'croppedOraLayersRestoreOffsets':True,
    'singlePosePaintEditReachesExport':True,'otherPosesUnaffectedByPosePaint':True,
    'staleBaseRejected':True,'archivedBaseEditRejected':True,
    'failedApplyPreservesExistingOutput':True,'testArtifacts':str(work.relative_to(ROOT)).replace('\\','/'),
    'recipeSha256':hashlib.sha256(recipe_path.read_bytes()).hexdigest(),'artApproved':False}
(source/(recipe['tag']+'-finish-validation.json')).write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report))
