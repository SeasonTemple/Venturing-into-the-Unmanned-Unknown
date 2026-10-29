"""Internal full-body transfer study from CMU 07_01, not approved sprite art.

Uses complete reference poses and the source actor's proportions. Carries the
head from its neck and the neck from its chest; occupied arms are damped, not
frozen. Renders original cloth through continuous ribbons and keeps props rigid.
No generative frames or rejected mid-thigh hinge/contour recipes are reused.
"""
import argparse, hashlib, json, math, subprocess
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--out-dir',type=Path,required=True);args=parser.parse_args()
OUT=args.out_dir.resolve()
if (OUT/'transfer.json').exists():raise ValueError('Use a new version directory')
OUT.mkdir(parents=True,exist_ok=True);(OUT/'frames').mkdir(exist_ok=True)
doc=json.loads((ROOT/'.lab/whole-walk/cmu-sampled/world-joints.json').read_text())
frames=doc['frames']
source=Image.open(ROOT/'prototypes/visual-direction/art-pack-media/actor-front.png').convert('RGBA')
layers={p.stem:Image.open(p).convert('RGBA') for p in (ROOT/'prototypes/visual-direction/actor-keypose-art/source-layers').glob('*.png')}
under=Image.open(ROOT/'prototypes/visual-direction/actor-lane-body03/stride/upper-underpaint.png').convert('RGBA')
torso=under.copy();torso.alpha_composite(layers['upper_body'])
cloth={}
import io,zipfile
from xml.etree.ElementTree import fromstring
with zipfile.ZipFile(ROOT/'prototypes/visual-direction/actor-keypose-art/working-cloth.ora') as z:
    for l in fromstring(z.read('stack.xml')).find('stack'):
        if l.get('name','').startswith('cloth_'):cloth[l.get('name')[-1]]=Image.open(io.BytesIO(z.read(l.get('src')))).convert('RGBA')
SIZE=(220,400);OFFSET=np.array([32.,26.])
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',16)

def norm(v):return v/max(1e-8,np.linalg.norm(v))
def project(v):
    # A fixed front-quarter camera: the forward path is left and slightly up.
    # Unlike the old lateral lane this projection shares the actor's facing.
    return np.array([.86*v[0]-.51*v[2],-.98*v[1]-.12*v[2]+.07*v[0]])
def angle(v):return math.degrees(math.atan2(v[1],v[0]))
def rot(v,a):
    a=math.radians(a);return np.array([[math.cos(a),-math.sin(a)],[math.sin(a),math.cos(a)]])@np.array(v)
def joints(fn):return {k:np.array(v) for k,v in frames[fn]['joints'].items()}

def triangle(dst, src, sp, tp):
    sp=np.array(sp);tp=np.array(tp)+OFFSET
    lo=np.maximum(np.floor(tp.min(0)).astype(int),0);hi=np.minimum(np.ceil(tp.max(0)).astype(int)+1,SIZE)
    if np.any(hi<=lo):return
    mat=np.vstack((tp.T,np.ones(3)))
    if abs(np.linalg.det(mat))<1e-5:return
    yy,xx=np.mgrid[lo[1]:hi[1],lo[0]:hi[0]]
    bc=np.linalg.inv(mat)@np.vstack((xx.ravel()+.0,yy.ravel()+.0,np.ones(xx.size)))
    inside=(bc>=-1e-6).all(0)
    uv=sp.T@bc;u=np.rint(uv[0]).astype(int);v=np.rint(uv[1]).astype(int)
    valid=inside&(u>=0)&(u<src.shape[1])&(v>=0)&(v<src.shape[0])
    values=src[np.clip(v,0,src.shape[0]-1),np.clip(u,0,src.shape[1]-1)]
    valid&=values[:,3]>0
    dst[yy.ravel()[valid],xx.ravel()[valid]]=values[valid]

def mesh(src,fn,ys,xs=range(0,157,12)):
    pixels=np.array(src);result=np.zeros((SIZE[1],SIZE[0],4),dtype=np.uint8);xs=list(xs)
    if xs[-1]!=156:xs.append(156)
    for a,b in zip(ys,ys[1:]):
        for l,r in zip(xs,xs[1:]):
            ps=[(l,a),(r,a),(r,b),(l,b)];qs=[fn(np.array(p,dtype=float)) for p in ps]
            triangle(result,pixels,[ps[i] for i in [0,1,2]],[qs[i] for i in [0,1,2]])
            triangle(result,pixels,[ps[i] for i in [0,2,3]],[qs[i] for i in [0,2,3]])
    return Image.fromarray(result)

def rigid(src,pivot,target,degrees):
    c,s=math.cos(math.radians(degrees)),math.sin(math.radians(degrees));t=np.array(target)+OFFSET;p=np.array(pivot)
    return src.transform(SIZE,Image.Transform.AFFINE,(c,s,p[0]-c*t[0]-s*t[1],-s,c,p[1]+s*t[0]-c*t[1]),resample=Image.Resampling.NEAREST)

def chain_warp(src,points,targets,cut_y=None):
    ps=np.array(points,float);ts=np.array(targets,float)
    def fn(p):
        y=p[1];i=next((i for i in range(len(ps)-1) if y<=ps[i+1,1]),len(ps)-2)
        u=(y-ps[i,1])/(ps[i+1,1]-ps[i,1]);center=ps[i]+u*(ps[i+1]-ps[i]);target=ts[i]+u*(ts[i+1]-ts[i])
        axis=norm(ts[i+1]-ts[i]);right=np.array([axis[1],-axis[0]])
        return target+right*(p[0]-center[0])
    ys=sorted(set([int(p[1]) for p in ps]+list(range(int(ps[0,1]),int(ps[-1,1])+1,8))))
    return mesh(src,fn,ys)

def sample(fn):
    j=joints(fn)
    hips={};knees={};ankles={};boot_angles={}
    # Morphology is fixed once for this source, rather than resizing parts on
    # individual frames. Project full 3D femur and tibia directions.
    root=np.array([78.,187.-(j['root'][1]-16.2)*9.4])
    for side,sign,hip,knee,ankle in [('R',-1,[61,187],[61,254],[58,319]),('L',1,[95,188],[101,260],[104,328])]:
        s=side.lower();hips[side]=root+np.array([sign*17,side=='L'])
        knees[side]=hips[side]+project(norm(j[s+'femur']-j[s+'hipjoint']))*np.linalg.norm(np.array(knee)-hip)
        ankles[side]=knees[side]+project(norm(j[s+'tibia']-j[s+'femur']))*np.linalg.norm(np.array(ankle)-knee)
        foot=j[s+'foot']-j[s+'tibia']
        # Ankle-to-ball contains the original downward foot slope. Subtract
        # the planted baseline before transferring pitch to the painted boot.
        boot_angles[side]=float(np.clip(math.degrees(math.atan2(foot[1],foot[2]))+41,-23,23))
    support=min(['R','L'],key=lambda s:j[s.lower()+'foot'][1])
    # Correct the target's different leg proportions at the actual support.
    # This is a retargeting contact correction, not a new mocap observation.
    sole=ankles[support][1]+(18 if support=='R' else 20)
    depth=-(j[support.lower()+'foot'][2]-j['root'][2])*1.1
    dy=(337 if support=='R' else 348)+depth-sole
    for table in [hips,knees,ankles]:
        for side in table:table[side][1]+=dy
    root[1]+=dy
    chest=root+project(norm(j['thorax']-j['root']))*103
    neck=chest+project(norm(j['lowerneck']-j['thorax']))*17
    hv=project(norm(j['head']-j['lowerneck']))
    head_angle=float(np.clip(angle(hv)+90,-4,4))
    head=neck+rot([1,-35],head_angle)
    # Frame-varying shoulder foreshortening follows the measured chest axis.
    shoulder_axis=j['lclavicle']-j['rclavicle'];yaw=float(np.clip(project(norm(shoulder_axis))[0]/.86,.92,1.05))
    def body(p):
        x,y=p
        if y<=65:return neck+rot(p-np.array([81,65]),head_angle)
        if y<84:
            t=(y-65)/19;center=neck*(1-t)+chest*t
        else:
            t=(y-84)/103;center=chest*(1-t)+root*t
        sx=81 if y<65 else (81-(min(84,y)-65)/19*3 if y<84 else 78)
        return center+np.array([(x-sx)*yaw,0])
    sr,sl=body(np.array([47,84.])),body(np.array([110,80.]))
    arms={}
    for side,shoulder,elbow,wrist in [('R',sr,[35,119],[25,170]),('L',sl,[141,126],[108,158])]:
        s=side.lower();v=j[s+'humerus']-j[s+'clavicle'];q=project(norm(v))
        # Occupied arms retain their source grip and most of their rest bend.
        # CMU is unloaded: only the measured phase is used at reduced amplitude.
        forward=v[2]/max(1e-8,np.linalg.norm(v));a=float(np.clip(forward*13,-6,6))
        start=np.array([47,84]) if side=='R' else np.array([110,80])
        e=shoulder+rot(np.array(elbow)-start,a)
        bend=float(np.clip((j[s+'radius'][2]-j[s+'humerus'][2])*1.5,-2.5,2.5))
        w=e+rot(np.array(wrist)-elbow,a+bend)
        arms[side]={'shoulder':shoulder,'elbow':e,'wrist':w,'angle':a,'bend':bend}
    return {'sourceFrame':fn+1,'hips':hips,'knees':knees,'ankles':ankles,'root':root,'chest':chest,'neck':neck,'head':head,
            'headAngle':head_angle,'support':support,'body':body,'arms':arms,'bootAngles':boot_angles}

def render(p):
    stack=[]
    for side in ['R','L']:
        hip=[61,187] if side=='R' else [95,188];knee=[61,254] if side=='R' else [101,260];ankle=[58,319] if side=='R' else [104,328]
        leg=cloth[side].copy();ImageDraw.Draw(leg).rectangle((0,312 if side=='R' else 319,156,348),fill=(0,0,0,0))
        upper=np.array(p['hips'][side])+norm(p['hips'][side]-p['knees'][side])*10
        pic=chain_warp(leg,[[hip[0],177],hip,knee,ankle],[upper,p['hips'][side],p['knees'][side],p['ankles'][side]])
        boots=cloth[side].copy();ImageDraw.Draw(boots).rectangle((0,0,156,311 if side=='R' else 318),fill=(0,0,0,0))
        stack += [('trouser_'+side,pic),('boot_'+side,rigid(boots,ankle,p['ankles'][side],p['bootAngles'][side]))]
    arm_layers=[]
    for side in ['R','L']:
        a=p['arms'][side];sp=[[47,84],[35,119],[25,170]] if side=='R' else [[110,80],[141,126],[108,158]]
        # Keep the source bent left arm continuous; cap overlap belongs to it.
        arm=chain_warp(layers['arm_'+side],sp,[a['shoulder'],a['elbow'],a['wrist']])
        arm_layers.append(('arm_'+side,arm))
    stack+=arm_layers
    stack += [('continuous_head_neck_coat',mesh(torso,p['body'],[0,25,50,65,75,84,100,120,145,165,184]))]
    r,l=p['arms']['R'],p['arms']['L']
    stack += [('toolbox_R',rigid(layers['toolbox_R'],[25,170],r['wrist'],0)),
              ('glove_R',rigid(layers['glove_R'],[25,170],r['wrist'],r['angle']+r['bend'])),
              ('recorder_L',rigid(layers['recorder_L'],[108,158],l['wrist'],l['angle']+l['bend']))]
    im=Image.new('RGBA',SIZE)
    for _,layer in stack:im.alpha_composite(layer)
    return im,stack

records=[];images=[]
selected=list(range(0,240,5))  # Two genuine measured steps/cycles, no loop fiction.
for i,fn in enumerate(selected):
    p=sample(fn);im,stack=render(p);images.append(im);im.save(OUT/'frames'/f'{i:03}.png')
    record={k:v for k,v in p.items() if k!='body'}
    records.append(record)
def serial(v):
    if isinstance(v,np.ndarray):return v.tolist()
    raise TypeError(type(v))
review=Image.new('RGB',(8*220,460),'#e1e5d7');d=ImageDraw.Draw(review)
for i,f in enumerate([0,6,12,18,24,30,36,42]):
    review.paste(images[f],(220*i,30),images[f]);d.text((220*i+12,8),f'CMU {selected[f]+1}',font=font,fill='#244238')
review.save(OUT/'keyposes.png')
# A finite playback includes motion at native size and ~104px scene scale.
plate=Image.open(ROOT/'prototypes/visual-direction/meadow-media/walk-plate-v01.webp').convert('RGB')
video=OUT/'review-frames';video.mkdir(exist_ok=True)
for i,im in enumerate(images):
    page=Image.new('RGB',(1000,720),'#e1e5d7');d=ImageDraw.Draw(page)
    d.text((24,20),'完整动作转移试片 / CMU 07_01 / 非最终人物动画',font=font,fill='#244238')
    page.paste(im,(40,90),im)
    double=im.resize((440,800),Image.Resampling.NEAREST)
    page.paste(double.crop((0,0,440,650)),(540,60),double.crop((0,0,440,650)))
    smallplate=plate.resize((480,270));page.paste(smallplate,(24,440))
    small=im.resize((66,120),Image.Resampling.NEAREST)
    root=(frames[selected[i]]['joints']['root'][2]-frames[0]['joints']['root'][2])*4.8
    page.paste(small,(int(390-root),555),small)
    page.save(video/f'{i:03}.png')
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-framerate','24','-i',str(video/'%03d.png'),'-c:v','libx264','-crf','16','-pix_fmt','yuv420p','-movflags','+faststart',str(OUT/'whole-motion.mp4')],check=True)
transfer={'method':__doc__,'sourceCharacterSha256':hashlib.sha256((ROOT/'prototypes/visual-direction/art-pack-media/actor-front.png').read_bytes()).hexdigest(),
          'motionSource':doc['source'],'sourceFps':120,'exportFps':24,'frames':records,
          'artApproved':False,'userApproved':False,'productionIntegrated':False,
          'limitations':['Unladen motion with analytical occupied-arm adaptation, not captured loaded motion.',
                         'Single-view source texture transfer, not full-pose redraw or a new facing.',
                         'Finite measured segment; start/stop and seamless loop are not inferred from this clip.']}
(OUT/'transfer.json').write_text(json.dumps(transfer,default=serial,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(str(OUT/'keyposes.png'))
