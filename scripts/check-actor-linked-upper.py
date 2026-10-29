"""Verify the exported face and chest actually follow the same rigid pose.

Tests pose/raster connectivity, not natural animation or art acceptance.
"""
import argparse
import json
import math
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('directory',type=Path)
args=parser.parse_args()
original=Image.open('prototypes/visual-direction/art-pack-media/actor-front.png').convert('RGBA')
mask=Image.new('L',original.size)
draw=ImageDraw.Draw(mask)
draw.rectangle((0,0,155,58),fill=255)
draw.rectangle((62,90,90,130),fill=255)
reference=original.copy()
reference.putalpha(ImageChops.multiply(original.getchannel('A'),mask))
baseline=Path('prototypes/visual-direction/actor-lane-media')
count=0
head_positions=[]
for clip in ['start','stride','stop-L','stop-R']:
    directory=args.directory/clip
    data=json.loads((directory/'motion.json').read_text())
    old=json.loads((baseline/clip/'motion.json').read_text())
    assert len(data['frames'])==len(old['frames'])
    for record,before in zip(data['frames'],old['frames']):
        assert record['feet']==before['feet'],(clip,record['frame'],'Foot paths changed')
        pose=record['upperPose']
        for a,b in [('head','neck'),('neck','chest')]:
            assert abs(math.dist(pose[a],pose[b])-40)<1e-7
        angle=math.radians(pose['angle']);c,s=math.cos(angle),math.sin(angle)
        px,py=pose['pivot'];tx,ty=pose['target'][0]+130,pose['target'][1]+26
        expected=reference.transform((400,400),Image.Transform.AFFINE,
            (c,s,px-c*tx-s*ty,-s,c,py+s*tx-c*ty),resample=Image.Resampling.NEAREST)
        world=Image.new('RGBA',(400,400));world.alpha_composite(expected,(pose['rasterShift'],0))
        opaque=world.getchannel('A').point(lambda a:255 if a==255 else 0)
        actual=Image.open(directory/record['file']).convert('RGB')
        error=ImageChops.multiply(ImageChops.difference(actual,world.convert('RGB')),opaque.convert('RGB'))
        assert error.getbbox() is None,(clip,record['frame'],'Head or chest did not follow common affine pose')
        if clip=='stride':
            head_positions.append(pose['head'][0]+pose['rasterShift']-record['rootX'])
        count+=1
assert max(head_positions)-min(head_positions)>3,'Head still horizontally pinned'
neutral=Image.open(args.directory/'start/frames/000.png')
old_neutral=Image.open(baseline/'start/frames/000.png')
assert ImageChops.difference(neutral,old_neutral).getbbox(alpha_only=False) is None
result={'framesChecked':count,'exportedHeadAndChestUseSameRigidPose':True,
    'headNeckAndNeckChestDistancesConstant':True,'headMovesWithTorso':True,
    'neutralPoseUnchanged':True,'footTracksUnchanged':True,'artApprovalImplied':False}
(args.directory/'linked-upper-checks.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
