"""Read CMU ASF/AMC walking data into inspectable world-space joints.

Motion reference only: this does not assert that a target sprite is animated.
All rotations are applied through the source hierarchy, with ASF axis bases.
"""
import json, math, hashlib, argparse
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--source-dir',type=Path,default=ROOT/'prototypes/visual-direction/actor-motion-reference-v02/source');args=parser.parse_args()
SRC=args.source_dir.resolve()
OUT=ROOT/'.lab/whole-walk/cmu-sampled';OUT.mkdir(parents=True,exist_ok=True)

def rotation(values):
    x,y,z=np.radians(values);cx,sx=math.cos(x),math.sin(x);cy,sy=math.cos(y),math.sin(y);cz,sz=math.cos(z),math.sin(z)
    return np.array([[cz,-sz,0],[sz,cz,0],[0,0,1]])@np.array([[cy,0,sy],[0,1,0],[-sy,0,cy]])@np.array([[1,0,0],[0,cx,-sx],[0,sx,cx]])

lines=[l.strip() for l in (SRC/'07.asf').read_text().splitlines()]
bones={};hierarchy={};mode='';current=None
for line in lines:
    if line.startswith(':'):mode=line
    if mode==':bonedata':
        if line=='begin':current={}
        elif line=='end':bones[current['name']]=current;current=None
        elif current is not None:
            fields=line.split()
            if not fields:continue
            if fields[0]=='name':current['name']=fields[1]
            elif fields[0] in ['direction','axis']:current[fields[0]]=list(map(float,fields[1:4]))
            elif fields[0]=='length':current['length']=float(fields[1])
            elif fields[0]=='dof':current['dof']=fields[1:]
    elif mode==':hierarchy' and line not in ['begin','end',':hierarchy']:
        fields=line.split()
        if fields:hierarchy[fields[0]]=fields[1:]
frames=[]
for line in (SRC/'07_01.amc').read_text().splitlines():
    line=line.strip()
    if not line or line[0] in '#:':continue
    fields=line.split()
    if fields[0].isdigit():frames.append({'frame':int(fields[0]),'channels':{}})
    else:frames[-1]['channels'][fields[0]]=list(map(float,fields[1:]))
for f in frames:
    channels=f['channels'];r=channels['root'];points={'root':np.array(r[:3])};mats={'root':rotation(r[3:])}
    def child(parent):
        for name in hierarchy.get(parent,[]):
            bone=bones[name];e=[0,0,0]
            for dof,v in zip(bone.get('dof',[]),channels.get(name,[])):e['xyz'.index(dof[-1])]=v
            c=rotation(bone['axis']);m=mats[parent]@c@rotation(e)@c.T
            points[name]=points[parent]+m@np.array(bone['direction'])*bone['length'];mats[name]=m
            child(name)
    child('root')
    f['joints']={k:v.tolist() for k,v in points.items()}
    # Retargeters need the pelvis orientation as well as joint directions.
    # Dropping this silently removes hip roll, yaw and lateral weight transfer.
    conversion=np.array([[1,0,0],[0,0,-1],[0,1,0]])
    f['pelvisOrientation']=(conversion@mats['root']@conversion.T).tolist()
    f['boneOrientations']={name:(conversion@matrix@conversion.T).tolist() for name,matrix in mats.items()}
    # The three joint centres do not define a bend plane when the knee is
    # straight. Preserve the ASF hinge itself, including its anatomical sign.
    # Its world orientation comes from the femur and the tibia's axis basis;
    # rotating about that hinge does not change the hinge direction.
    f['kneeHingeAxes']={s:(conversion@mats[s+'femur']@rotation(bones[s+'tibia']['axis'])@np.array([1.,0.,0.])).tolist() for s in ['r','l']}
    f['kneeFlexionDegrees']={s:channels[s+'tibia'][0] for s in ['r','l']}
    f['elbowHingeAxes']={s:(conversion@mats[s+'humerus']@rotation(bones[s+'radius']['axis'])@np.array([1.,0.,0.])).tolist() for s in ['r','l']}
    f['elbowFlexionDegrees']={s:channels[s+'radius'][0] for s in ['r','l']}
    del f['channels']

doc={'source':'https://mocap.cs.cmu.edu/subjects/07/07_01.amc','subject':7,'trial':1,'sourceFps':120,
     'purpose':'Unladen human walking reference, not the target character or its loaded final motion.',
     'files':{name:hashlib.sha256((SRC/name).read_bytes()).hexdigest() for name in ['07.asf','07_01.amc']},
     'hierarchy':hierarchy,'frames':frames}
(OUT/'world-joints.json').write_text(json.dumps(doc,indent=2))
# Side projection of the actual world motion, no invented leg trajectories.
sheet=Image.new('RGB',(1600,430),'#e3e7dc');d=ImageDraw.Draw(sheet)
selected=[1,31,61,91,121,151,181,211]
for i,fn in enumerate(selected):
    f=frames[min(fn,len(frames))-1];j={k:np.array(v) for k,v in f['joints'].items()};base=j['root']
    def xy(v):return (i*200+100-(v[2]-base[2])*8,365-v[1]*8)
    for par,children in hierarchy.items():
        for name in children:
            if any(s in name for s in ['finger','thumb','hand','wrist','clavicle']):continue
            d.line([xy(j[par]),xy(j[name])],fill='#b56e37' if name.startswith('r') else '#385f59',width=5)
    for name in ['root','lfemur','ltibia','rfemur','rtibia','thorax','head']:
        x,y=xy(j[name]);d.ellipse((x-4,y-4,x+4,y+4),fill='#223a32')
    d.text((i*200+12,12),f'source frame {fn}',fill='#223a32')
sheet.save(OUT/'source-joints-review.png')
print(json.dumps({'frames':len(frames),'selection':selected,'rootStart':frames[0]['joints']['root'],'rootEnd':frames[-1]['joints']['root']}))
