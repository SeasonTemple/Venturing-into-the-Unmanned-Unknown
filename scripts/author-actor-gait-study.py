"""Author a rear-foot-first gait candidate using the existing raster rig."""
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
source=ROOT/'prototypes/visual-direction/actor-rig-v03/actor-rig-v03.spec.json'
out=ROOT/'prototypes/visual-direction/actor-rig-v05'
out.mkdir(exist_ok=True)
target=out/'actor-rig-v05.spec.json'
if target.exists():raise ValueError('Keep existing authored controls; edit the versioned spec or create a new version')
spec=json.loads(source.read_text(encoding='utf-8'))
spec['version']='actor-rig-v05'
spec['scope']='Rear left foot advances first, then alternating lead feet, continuous root travel and authored braking; fixed original view, art unapproved'
spec['poses']=[spec['poses'][0]]
# frame, name, label, root, R ankle shift, L ankle shift, trunk lean,
# loaded upper arm, forearm, loaded shoulder drop, box world angle.
keys=[
 (1,'loaded_stand','负重站立',[0,.3],[0,0],[0,0],.25,.3,1,1.1,0),
 (4,'prepare','支撑右脚，准备迈后脚',[-2,2],[0,0],[0,0],-.65,.7,1.5,1.7,.5),
 (8,'passing_L','左脚经过支撑脚',[-12,1.4],[0,0],[-36,-8],-1.4,1,2,2.1,-1.5),
 (13,'contact_L','左脚越过并落地',[-27,3],[0,0],[-64,0],-1.15,.5,1.8,2.2,-3),
 (15,'transfer_L','承重转到左脚',[-32,3.5],[0,0],[-64,0],-1.2,-.1,1.5,2.1,-1.8),
 (18,'passing_R','右脚经过支撑脚',[-40,1.4],[-30,-9],[-64,0],-1.35,-.8,1.6,2,-.1),
 (23,'contact_R','右脚越过并落地',[-53,1],[-60,0],[-64,0],-.8,-.3,1.6,2.1,2.5),
 (27,'braking','双脚着地，收回前倾',[-59,2.2],[-60,0],[-64,0],.65,.6,1.3,1.6,3),
 (31,'stopped','身体停稳，箱体回摆',[-60,.6],[-60,0],[-64,0],.25,.3,1,1.1,-1.1),
 (37,'settled','箱体回正',[-60,.6],[-60,0],[-64,0],.25,.3,1,1.1,0),
 (49,'stopped_hold','保持现场',[-60,.6],[-60,0],[-64,0],.25,.3,1,1.1,0),
]
fields=['frame','name','label','pelvisShift','rightFootShift','leftFootShift','torsoDegrees',
        'loadedArmDegrees','forearmDegrees','shoulderDropPx','toolboxWorldDegrees']
spec['poses'].extend(dict(zip(fields,key)) for key in keys)
spec['motion']={'fps':12,'startFrame':1,'actionName':'Rear foot first / alternating contacts / braking',
                'rootTravelInterpolation':'monotone-hermite',
                'supportIntervals':[{'from':1,'to':4,'legs':['R','L']},
                                    {'from':4,'to':13,'legs':['R']},
                                    {'from':13,'to':15,'legs':['R','L']},
                                    {'from':15,'to':23,'legs':['L']},
                                    {'from':23,'to':49,'legs':['R','L']}]}
target.write_text(json.dumps(spec,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(target)
