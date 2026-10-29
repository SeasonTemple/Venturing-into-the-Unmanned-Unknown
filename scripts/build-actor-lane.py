"""Build an editable start/stride/two-stop study, preserving earlier exports."""
import argparse
import copy
import hashlib
import json
import math
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw


parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--out-dir',type=Path,required=True)
parser.add_argument('--body-articulation',action='store_true')
parser.add_argument('--linked-upper',action='store_true')
args=parser.parse_args()
if args.linked_upper:args.body_articulation=True
out=args.out_dir
if (out/'lane.json').exists():
    raise ValueError('Export to a new directory; existing artwork is preserved')
out.mkdir(parents=True,exist_ok=True)
base=json.loads(Path('prototypes/visual-direction/actor-contour-motion/motion.spec.json').read_text())
original={k['frame']:k for k in base['motion']['keys']}
if args.body_articulation:
    base['motion']['bodyArticulation']=True
    for key in original.values():
        key.update(chestSway=0,hipSway=0,chestRoll=0,rightElbow=0)
    # Contact -> compression -> passing. The loaded shoulder reacts to the same
    # transfer, while the chest counters the pelvis and gaze stays stable.
    response={
        6:dict(bodyY=1,chestSway=-.5,hipSway=.5,chestRoll=-.5,rightElbow=.5),
        18:dict(bodyY=2,chestSway=-1.4,hipSway=1.8,chestRoll=-1.5,rightArm=2.8,leftArm=-1.8,rightElbow=1.8,boxAngle=.8),
        22:dict(bodyY=3,chestSway=-2.6,hipSway=2.2,chestRoll=-2.2,rightArm=4,leftArm=-2.4,rightElbow=2.5,boxAngle=2.2),
        28:dict(bodyY=-3,chestSway=-.8,hipSway=1.2,chestRoll=-1,rightArm=-3,leftArm=1.4,rightElbow=-1.5,boxAngle=1.4),
        34:dict(bodyY=2,chestSway=1.4,hipSway=-1.8,chestRoll=1.5,rightArm=-2.8,leftArm=1.8,rightElbow=-1.8,boxAngle=-.8),
        38:dict(bodyY=3,chestSway=2.6,hipSway=-2.2,chestRoll=2.2,rightArm=-4,leftArm=2.4,rightElbow=-2.5,boxAngle=-2.2),
        12:dict(bodyY=-3,chestSway=.8,hipSway=-1.2,chestRoll=1,rightArm=3,leftArm=-1.4,rightElbow=1.5,boxAngle=-1.4),
    }
    for frame,values in response.items():original[frame].update(values)
if args.linked_upper:
    base['motion']['linkedUpper']=True
    for key in original.values():
        key['torsoLean']=0
        key['chestSway']=0
        key['chestRoll']=0
    # Pelvis -> continuous torso/head -> shoulders -> arms -> held objects.
    # The neck is not a separate island with its own lateral control.
    linked_poses={
        6:dict(torsoLean=-.35,hipSway=.2,bodyY=1),
        18:dict(torsoLean=-.8,hipSway=.6,bodyY=1.5),
        22:dict(torsoLean=-1.2,hipSway=.8,bodyY=2),
        28:dict(torsoLean=-.3,hipSway=.4,bodyY=-1.5),
        34:dict(torsoLean=.8,hipSway=-.6,bodyY=1.5),
        38:dict(torsoLean=1.2,hipSway=-.8,bodyY=2),
        12:dict(torsoLean=.3,hipSway=-.4,bodyY=-1.5),
    }
    for frame,values in linked_poses.items():original[frame].update(values)

def contact(start,end,kind,x,y):
    return {'from':start,'to':end,'kind':kind,'anchor':[x,y]}

def recipe(name,keys,contacts,periodic=False):
    spec=copy.deepcopy(base)
    spec['motion']={**spec['motion'],'keys':keys,'contacts':contacts,'periodic':periodic,'canonicalRaster':True,
                    'editableFrames':list(dict.fromkeys([k['frame'] for k in keys])),
                    'title':name,'scope':'Single-view continuous stride candidate; not approved art',
                    'phaseLabels':[{'from':k['frame'],'label':k['pose']} for k in keys]}
    # Swing targets must meet the same grounded ankle solutions used at contact.
    for k in keys:
        for side,pivot,toe,heel in [('R',[58,319],[30,337],[66,337]),('L',[104,328],[90,347],[113,347])]:
            c=next((c for c in contacts[side] if c['from']<=k['frame']<=c['to']),None)
            if not c:continue
            a=math.radians(k['rightAngle' if side=='R' else 'leftAngle'])
            src=toe if c['kind']=='toe' else heel
            dx,dy=src[0]-pivot[0],src[1]-pivot[1]
            k['rightAnkleX' if side=='R' else 'leftAnkleX']=c['anchor'][0]-math.cos(a)*dx+math.sin(a)*dy
            k['rightAnkleY' if side=='R' else 'leftAnkleY']=c['anchor'][1]-math.sin(a)*dx-math.cos(a)*dy
    directory=out/name
    directory.mkdir(exist_ok=True)
    path=directory/'motion.spec.json'
    path.write_text(json.dumps(spec,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    subprocess.run([sys.executable,'-X','utf8','scripts/author-actor-contour-poses.py','--recipe',str(path),
                    '--cloth-master','prototypes/visual-direction/actor-keypose-art/working-cloth.ora',
                    '--out-dir',str(directory)],check=True)
    return spec

start_keys=[copy.deepcopy(original[f]) for f in [0,2,6,12,18]]
start=recipe('start',start_keys,{'R':[contact(0,18,'toe',30,337)],
    'L':[contact(0,6,'toe',90,347),contact(18,18,'heel',36.27,348.07)]})

stride_keys=[]
for f,source in [(0,18),(4,22),(10,28),(16,34),(20,38),(26,12),(32,18)]:
    k=copy.deepcopy(original[source]);k['frame']=f;k['rootX']=-86*f/32
    # Preserve explicit whole poses, while authoring swing paths for this stride.
    if f==10:k['rightAnkleX']=55
    if f==26:k['leftAnkleX']=18.125
    stride_keys.append(k)
stride=recipe('stride',stride_keys,{
    'R':[contact(0,4,'toe',61,337),contact(16,26,'heel',11,337),contact(27,32,'toe',-25,337)],
    'L':[contact(0,10,'heel',67.27,348.07),contact(11,20,'toe',44.27,348.07),contact(32,32,'heel',-18.73,348.07)]
},True)

right_keys=[]
for source in [34,38,44,52,58,64]:
    k=copy.deepcopy(original[source]);k['frame']=source-34;k['rootX']+=74
    right_keys.append(k)
stop_r=recipe('stop-R',right_keys,{
    'R':[contact(0,30,'heel',54,337)],'L':[contact(0,30,'toe',87.27,348.07)]})

left_keys=[copy.deepcopy(stride_keys[0])]
for f,box in [(6,1.5),(12,.5),(20,-.3),(26,0),(34,0)]:
    k=copy.deepcopy(stride_keys[0]);k.update(frame=f,rootX=-5,bodyX=0,bodyY=.5,headLead=0,
        rightArm=.1,leftArm=0,shoulderDrop=1,boxAngle=box,rightAngle=0,leftAngle=0)
    if args.body_articulation:k.update(chestSway=0,hipSway=0,chestRoll=0,rightElbow=0)
    if args.linked_upper:k.update(torsoLean=0)
    left_keys.append(k)
stop_l=recipe('stop-L',left_keys,{
    'R':[contact(0,34,'toe',61,337)],'L':[contact(0,34,'heel',67.27,348.07)]})

manifest={'fps':16,'cell':[200,400],'columns':8,'origin':[22,374],
          'strideFrames':32,'strideDistance':86,'artApproved':False,
          'bodyArticulation':args.body_articulation,
          'linkedUpper':args.linked_upper,
          'productionIntegrated':False,'newPaidMediaRequests':0,'clips':{}}
normalized={}
for name in ['start','stride','stop-R','stop-L']:
    directory=out/name
    motion=json.loads((directory/'motion.json').read_text())
    frames=[]
    for record in motion['frames']:
        im=Image.open(directory/record['file']).convert('RGBA')
        x=130+round(record['rootX'])-22
        frames.append(im.crop((x,0,x+200,400)))
    normalized[name]=frames
    atlas=Image.new('RGBA',(1600,400*math.ceil(len(frames)/8)))
    for i,im in enumerate(frames):atlas.paste(im,((i%8)*200,(i//8)*400))
    file=name+'.png';atlas.save(out/file)
    manifest['clips'][name]={'atlas':file,'frameCount':len(frames),
        'rootX':[r['rootX'] for r in motion['frames']],
        'sha256':hashlib.sha256((out/file).read_bytes()).hexdigest()}

checks={}
for label,a,b in [
    ('startToStride',normalized['start'][-1],normalized['stride'][0]),
    ('strideClosure',normalized['stride'][0],normalized['stride'][-1]),
    ('strideToLeftStop',normalized['stride'][0],normalized['stop-L'][0]),
    ('strideToRightStop',normalized['stride'][16],normalized['stop-R'][0]),
]:
    checks[label]=ImageChops.difference(a,b).getbbox(alpha_only=False) is None
    assert checks[label],label
checks['artApprovalImplied']=False
(out/'connection-checks.json').write_text(json.dumps(checks,indent=2)+'\n')
(out/'lane.json').write_text(json.dumps(manifest,indent=2)+'\n')

sheet=Image.new('RGB',(8*200,440),'#e1e5d7')
draw=ImageDraw.Draw(sheet)
for i,f in enumerate([0,4,10,16,20,26,31,32]):
    sheet.paste(normalized['stride'][f],(i*200,30),normalized['stride'][f])
    draw.text((i*200+10,10),f'phase {f}',fill='#244238')
sheet.save(out/'stride-review.png')
print(json.dumps(checks))
