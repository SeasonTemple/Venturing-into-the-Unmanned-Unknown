"""Reopen the actual actor rig, rerender the three saved poses and package review.

Technical consistency checks do not approve the drawing or the gait.
"""
import argparse
import hashlib
import json
import sys
import zipfile
from pathlib import Path

import bpy
from PIL import Image, ImageChops, ImageDraw, ImageFont

sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--out-dir', type=Path, default=ROOT / 'prototypes/visual-direction/actor-rig-media')
parser.add_argument('--tag', default='actor-v01', help='Version tag used by the chosen specification')
args = parser.parse_args()
OUT = args.out_dir.resolve()
TAG = args.tag
LAB = ROOT / '.lab/actor-layer-study'
LAB.mkdir(parents=True, exist_ok=True)
report = json.loads((OUT / (TAG+'.json')).read_text(encoding='utf-8'))
source = (OUT / report['source']).resolve()
assert hashlib.sha256(source.read_bytes()).hexdigest() == report['sourceSha256']
bpy.ops.wm.open_mainfile(filepath=str((OUT / (TAG+'-editable.blend')).resolve()),
                         load_ui=False, use_scripts=False)
scene = bpy.context.scene
rig = bpy.data.objects[report.get('rigName', 'ActorRig-v01')]
assert len(rig.data.bones) == report['bones'] == 18
used_images = {n.image for m in bpy.data.materials if m.use_nodes
               for n in m.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image}
assert len(used_images) == 9 and all(image.packed_file for image in used_images)
assert bpy.data.objects['toolbox_R'].vertex_groups.keys()[:] == ['toolbox_R']
assert bpy.data.objects['recorder_L'].vertex_groups.keys()[:] == ['recorder_L']
assert rig.data.bones['toolbox_R'].parent.name == 'hand_R'
assert rig.data.bones['recorder_L'].parent.name == 'hand_L'

record = {'scope': 'Saved layer/rig/pose/export consistency; not visual approval',
          'sourceSha256': report['sourceSha256'], 'bones': 18, 'packedTextures': 9,
          'anatomicalEquipmentParentsVerified': True, 'rerenders': [],
          'artApproved': False, 'walkCycleValidated': False, 'homepageIntegrated': False}
roundtrip_path = LAB / 'ora-edit-validation.json'
if roundtrip_path.is_file():
    roundtrip = json.loads(roundtrip_path.read_text(encoding='utf-8'))
    spec_path = (OUT/report['specification']).resolve() if 'specification' in report else ROOT/'prototypes/visual-direction/actor-rig-media/actor-rig-v01.spec.json'
    if (roundtrip.get('sourceSha256') == report['sourceSha256']
            and roundtrip.get('specSha256') == hashlib.sha256(spec_path.read_bytes()).hexdigest()):
        record['editableLayerRoundtrip'] = roundtrip
pose_images = []
for item in report['frames']:
    scene.frame_set(item['frame'])
    target = LAB / ('reopened-'+TAG+'-'+item['pose']+'.png')
    scene.render.filepath = str(target.resolve())
    bpy.ops.render.render(write_still=True)
    expected = Image.open(OUT / item['file']).convert('RGBA')
    actual = Image.open(target).convert('RGBA')
    assert ImageChops.difference(actual, expected).getbbox(alpha_only=False) is None
    assert actual.size == (220,400)
    pose_images.append(actual)
    record['rerenders'].append({'pose':item['pose'], 'frame':item['frame'], 'rgbaPixelsIdentical':True})

original = Image.open(source).convert('RGBA')
with zipfile.ZipFile(OUT / (TAG+'-layers.ora')) as archive:
    layer_merge = Image.open(archive.open('mergedimage.png')).convert('RGBA')
identical_source = ImageChops.difference(original, layer_merge).getbbox(alpha_only=False) is None
assert identical_source == report['sourceLayerReassemblyPixelIdentical']
record['sourceLayerMergePixelIdentical'] = identical_source
reference = Image.new('RGBA',(220,400))
reference.alpha_composite(layer_merge,(32,26))
diff = ImageChops.difference(reference,pose_images[0])
assert not diff.getchannel('A').getbbox()
visible_changes = sum(1 for a,b in zip(reference.get_flattened_data(),pose_images[0].get_flattened_data())
                      if (a[3] or b[3]) and a != b)
record['restRenderVsLayerMaster'] = {'silhouetteAlphaIdentical': True,
    'changedVisiblePixels': visible_changes,
    'maxChannelDifference': max(high for low, high in diff.getextrema()),
    'note': 'Layer merge is exact. Renderer texture sampling at a triangle boundary can differ slightly.'}
assert visible_changes < 10, 'Unexpected source identity/raster resampling at rest'
assert ImageChops.difference(pose_images[0],pose_images[1]).getbbox(alpha_only=False)
assert ImageChops.difference(pose_images[0],pose_images[2]).getbbox(alpha_only=False)

# Native output size and exact 2x display are separate from the scene scale
# study. 104 px is a display test, not a claim about source native pixel size.
font_path = 'C:/Windows/Fonts/msyh.ttc'
font = ImageFont.truetype(font_path,19)
small = ImageFont.truetype(font_path,14)
ink, quiet, bg = '#263e32', '#5c6d5a', '#dce1d2'
board = Image.new('RGB',(880,660),bg)
draw = ImageDraw.Draw(board)
draw.text((22,15),'原人物迁移 / 同一朝向 · 三个关键姿态',font=font,fill=ink)
draw.text((22,47),'保留原图比例、光色与装备；下列姿态用于检查形变，还不是完整步态。',font=small,fill=quiet)
labels = ['认可原图','分层母版 / 站立','承重接触候选','提脚经过候选']
for column, image in enumerate([reference]+pose_images):
    draw.text((column*220+20,82),labels[column],font=small,fill=ink)
    board.paste(image,(column*220,106),image)
draw.line((22,508,858,508),fill='#b8c4ae')
draw.text((22,524),'场景显示尺度检查 · 人物约 104 px 高（统一缩小）',font=small,fill=quiet)
for column,image in enumerate([reference]+pose_images):
    # Same canvas and scale for all; never separately crop/resize head or boots.
    tiny = image.resize((66,120),Image.Resampling.NEAREST)
    board.paste(tiny,(column*220+77,542),tiny)
board.save(OUT/(TAG+'-review.png'))
board.save(OUT/(TAG+'-review.webp'),lossless=True)

detail = Image.new('RGB',(1320,880),bg)
draw = ImageDraw.Draw(detail)
for column,image in enumerate(pose_images):
    enlarged=image.resize((440,800),Image.Resampling.NEAREST)
    detail.paste(enlarged,(column*440,50),enlarged)
    draw.text((column*440+22,16),labels[column+1]+' / 2×',font=font,fill=ink)
detail.save(OUT/(TAG+'-detail.png'))

switch_frames=[]
for index,image in enumerate(pose_images):
    view=Image.new('RGB',(440,850),bg)
    draw=ImageDraw.Draw(view)
    draw.text((22,12),labels[index+1],font=font,fill=ink)
    large=image.resize((440,800),Image.Resampling.NEAREST)
    view.paste(large,(0,45),large)
    switch_frames.append(view)
switch_frames[0].save(OUT/(TAG+'-pose-switch.webp'),save_all=True,
    append_images=switch_frames[1:],duration=[1300,1300,1300],loop=0,lossless=True)

# Inspect the actual editable layer contents, not only an opaque exploded figure.
layer_board=Image.new('RGB',(880,490),bg)
draw=ImageDraw.Draw(layer_board)
draw.text((22,12),'分层与遮挡内补区 / 9 层 · 统一 ½ 倍概览',font=font,fill=ink)
for index,mesh in enumerate(report['meshes']):
    name=mesh['name'];col=index%5;row=index//5
    image=Image.open(OUT/report.get('layersDirectory', 'layers-v01')/(name+'.png')).convert('RGBA')
    bbox=image.getbbox();crop=image.crop(bbox)
    # All parts use one 0.5x overview scale; no independent fitting of parts.
    crop=crop.resize((max(1,crop.width//2),max(1,crop.height//2)),Image.Resampling.NEAREST)
    x,y=22+col*172,50+row*210
    draw.text((x,y),name,font=small,fill=ink)
    layer_board.paste(crop,(x,y+26),crop)
draw.text((22,466),'小幅袖口补区来自相邻衣料取色；完整隐藏肢体与另一朝向尚未补绘。',font=small,fill=quiet)
layer_board.save(OUT/(TAG+'-layers-review.png'))

(OUT/(TAG+'-validation.json')).write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(record,ensure_ascii=False))
