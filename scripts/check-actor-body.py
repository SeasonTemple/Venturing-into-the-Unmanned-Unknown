"""Check body02's unchanged identity/feet and loaded shoulder/elbow coverage.

The free arm/torso gap and box handle are deliberately excluded from the
enclosed-gap scan. These checks do not judge anatomy or animation quality.
"""
import argparse
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('directory',type=Path)
parser.add_argument('--baseline',type=Path,default=Path('prototypes/visual-direction/actor-lane-media'))
args=parser.parse_args()
source=Image.open('prototypes/visual-direction/art-pack-media/actor-front.png').convert('RGBA')
head=source.crop((0,0,source.width,65))
issues=[]
count=0
for name in ['start','stride','stop-L','stop-R']:
    directory=args.directory/name
    motion=json.loads((directory/'motion.json').read_text())
    old=json.loads((args.baseline/name/'motion.json').read_text())
    assert len(motion['frames'])==len(old['frames'])
    for record,before in zip(motion['frames'],old['frames']):
        assert record['feet']==before['feet'],(name,record['frame'],'Changed foot track')
        image=Image.open(directory/record['file']).convert('RGBA')
        hx,hy=record['headRasterShift']
        actual=image.crop((130+hx,26+hy,130+hx+156,26+hy+65))
        assert ImageChops.difference(actual,head).getbbox(alpha_only=False) is None
        # Loaded shoulder to elbow; intentional free forearm space is lower.
        mask=image.getchannel('A').crop((155+hx,96+hy,220+hx,156+hy)).point(lambda a:255 if a else 0)
        for point in ([(x,0) for x in range(65)]+[(x,59) for x in range(65)]
                      +[(0,y) for y in range(60)]+[(64,y) for y in range(60)]):
            if mask.getpixel(point)==0:ImageDraw.floodfill(mask,point,128)
        if 0 in mask.get_flattened_data():issues.append([name,record['frame']])
        count+=1
neutral=Image.open(args.directory/'start/frames/000.png')
old_neutral=Image.open(args.baseline/'start/frames/000.png')
neutral_same=ImageChops.difference(neutral,old_neutral).getbbox(alpha_only=False) is None
assert neutral_same
assert not issues,issues
result={'framesChecked':count,'neutralPoseUnchanged':neutral_same,'footTracksUnchanged':True,
        'headRasterPreserved':True,'shoulderElbowEnclosedGaps':issues,'artApprovalImplied':False}
(args.directory/'body-checks.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
