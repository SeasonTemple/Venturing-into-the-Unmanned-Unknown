"""Editable static repaint experiment; not a rig or walking-frame generator.

Retains source head, torso and case arm. Explicit raster paint shapes replace
both trouser/boot structures and the recorder-side sleeve and glove. No old
leg deformation, cloth resampling, IK, video or paid generation is used.
"""
import argparse
import hashlib
import io
import json
import sys
import zipfile
from pathlib import Path
from xml.etree.ElementTree import Element, SubElement, tostring

from PIL import Image, ImageDraw, ImageFont

from actor_whole_pose import WholePoseArt

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--out-dir', type=Path, required=True)
args = parser.parse_args()
out = args.out_dir.resolve()
if out.exists():
    raise ValueError('Use a new directory to preserve prior paint sources')
out.mkdir(parents=True)
source_path = ROOT/'prototypes/visual-direction/art-pack-media/actor-front.png'
source = Image.open(source_path).convert('RGBA')
size = source.size
paths = ROOT/'prototypes/visual-direction/actor-keypose-art/source-layers'
src = {p.stem: Image.open(p).convert('RGBA') for p in paths.glob('*.png')}
art = WholePoseArt(src, size, (0, 0))
stack = []
shapes = []


def paint(name, base, polygons, lines=()):
    im = Image.new('RGBA', size)
    draw = ImageDraw.Draw(im)
    draw.polygon(base, fill=polygons[0][0])
    for color, points in polygons[1:]:
        draw.polygon(points, fill=color)
    for color, points, width in lines:
        draw.line(points, fill=color, width=width)
    stack.append((name, im))
    shapes.append({'layer': name, 'silhouette': base, 'polygons': polygons, 'lines': lines})
    return im


paint('far_trouser_repaint',
      [(84,184),(109,183),(113,196),(113,217),(117,241),(120,255),
       (117,278),(118,305),(120,322),(102,325),(99,307),(98,282),
       (95,262),(92,246),(90,224),(84,208)], [
    ('#1e2c2c', []),
    ('#293a31', [(85,187),(97,188),(101,215),(102,240),(108,259),(106,285),(109,319),(102,323),(99,300),(97,279),(94,260),(91,242),(89,219)]),
    ('#222e2b', [(99,190),(108,188),(111,207),(110,227),(114,244),(117,256),(113,280),(115,317),(110,319),(106,283),(108,258),(101,237)]),
    ('#4d5c45', [(89,209),(93,215),(96,240),(99,253),(98,263),(95,253),(92,239)]),
    ('#364735', [(99,270),(103,275),(105,299),(106,315),(102,315),(100,294)]),
    ('#1a2527', [(107,250),(115,250),(117,256),(113,260),(108,258)]),
    ('#1d262a', [(110,282),(116,277),(116,304),(118,318),(113,320)]),
    ('#4d5c45', [(102,318),(110,316),(112,320),(106,324),(102,324)]),
    ('#344538', [(93,215),(96,219),(97,231),(95,237),(94,228)]),
    ('#42533e', [(94,232),(97,236),(98,242),(96,246),(94,242)]),
    ('#6c7853', [(95,243),(97,245),(99,252),(98,255),(96,252)]),
    ('#7e8c60', [(96,246),(98,249),(98,252),(97,252)]),
    ('#2c3e34', [(101,263),(106,261),(106,265),(103,269),(100,267)]),
    ('#3f5140', [(100,279),(103,281),(104,290),(102,293)]),
    ('#526144', [(102,290),(104,292),(105,300),(104,305),(102,301)]),
    ('#77825a', [(103,301),(105,303),(107,313),(106,316),(104,311)]),
    ('#919a67', [(104,309),(106,311),(107,316),(105,317)]),
])

paint('far_boot_repaint',
      [(103,317),(119,317),(120,323),(124,328),(127,331),(127,336),
       (123,340),(101,340),(95,337),(94,332),(98,328),(101,323)], [
    ('#16171f', []),
    ('#252b2d', [(104,319),(116,319),(118,328),(123,331),(123,335),(113,337),(98,335),(98,332),(105,327)]),
    ('#3d4841', [(104,320),(108,320),(111,328),(106,333),(98,334),(99,331),(104,326)]),
    ('#6c705e', [(98,331),(103,329),(107,331),(106,333),(97,334),(96,333)]),
    ('#2f3134', [(96,335),(106,337),(123,336),(125,333),(125,337),(122,339),(101,339),(96,337)]),
    ('#a0a88a', [(97,335),(103,336),(103,337),(98,337)]),
    ('#535b52', [(109,322),(114,323),(115,325),(110,324)]),
    ('#414940', [(108,326),(113,327),(114,329),(109,328)]),
    ('#6c705e', [(104,331),(108,330),(112,333),(110,334),(105,333)]),
])

paint('near_trouser_repaint',
      [(44,184),(78,187),(79,204),(75,225),(72,245),(73,260),
       (76,278),(77,298),(77,316),(72,322),(57,320),(54,305),
       (52,285),(49,266),(48,249),(47,234),(43,213),(41,198)], [
    ('#1d262a', []),
    ('#293a31', [(45,187),(62,189),(66,211),(64,230),(61,247),(62,266),(66,285),(66,316),(58,317),(55,299),(53,281),(51,261),(50,244),(47,222),(44,206)]),
    ('#222e2b', [(62,190),(74,190),(75,207),(70,229),(67,246),(69,262),(72,281),(73,313),(66,316),(65,286),(61,266),(60,245),(64,221)]),
    ('#4d5c45', [(45,203),(49,209),(52,228),(54,243),(54,255),(51,249),(49,233),(46,220)]),
    ('#3e503a', [(54,249),(59,247),(65,249),(68,254),(63,257),(55,255)]),
    ('#99a36f', [(51,250),(53,250),(54,255),(53,257),(51,255)]),
    ('#364735', [(55,268),(59,271),(63,288),(63,305),(60,308),(58,293)]),
    ('#4d5c45', [(57,297),(61,299),(62,307),(65,312),(61,315),(58,309)]),
    ('#1a2527', [(67,259),(71,261),(74,278),(75,299),(74,313),(69,316),(68,291)]),
    ('#364735', [(58,316),(67,314),(71,316),(67,320),(59,320)]),
    ('#3b4e3e', [(48,218),(50,221),(53,233),(53,244),(51,242),(49,231)]),
    ('#637552', [(50,232),(52,235),(53,245),(52,249),(50,246)]),
    ('#7d895f', [(51,243),(53,246),(55,250),(54,253),(52,251)]),
    ('#b6bb82', [(52,250),(54,252),(54,255),(53,255)]),
    ('#475a40', [(54,258),(58,260),(61,259),(63,261),(60,264),(56,263)]),
    ('#2b3b32', [(55,265),(58,265),(60,274),(59,280),(57,277)]),
    ('#526647', [(55,274),(57,276),(58,288),(57,291),(55,285)]),
    ('#829264', [(56,284),(58,286),(59,295),(58,299),(56,293)]),
    ('#a4ac76', [(57,291),(59,292),(60,300),(58,303),(57,300)]),
    ('#778658', [(58,302),(61,304),(63,310),(62,314),(59,311)]),
    ('#4b5f42', [(64,293),(66,295),(67,308),(65,313),(64,308)]),
    ('#7d885e', [(59,313),(62,313),(65,317),(62,318),(59,316)]),
])

paint('near_boot_repaint',
      [(58,314),(75,313),(76,322),(78,330),(77,337),(72,340),
       (39,340),(36,337),(38,332),(44,328),(53,325),(56,320)], [
    ('#16141e', []),
    ('#1e1f25', [(59,315),(72,315),(72,327),(75,332),(73,336),(42,337),(40,334),(46,331),(57,327)]),
    ('#2f3134', [(58,318),(64,317),(64,327),(58,332),(44,335),(40,335),(43,332),(54,328)]),
    ('#6c705e', [(55,325),(60,323),(62,326),(59,329),(52,330),(46,333),(42,333),(47,329)]),
    ('#c1c2ab', [(43,332),(47,331),(51,331),(49,333),(43,334),(40,335)]),
    ('#2f3134', [(38,336),(47,337),(73,337),(76,334),(76,338),(71,340),(40,339)]),
    ('#6c705e', [(39,336),(47,337),(51,337),(51,338),(41,338)]),
    ('#414940', [(59,319),(65,320),(65,322),(59,321)]),
    ('#535b52', [(57,323),(62,323),(63,325),(58,325)]),
    ('#252b2d', [(48,333),(53,330),(58,330),(61,333),(55,334)]),
    ('#8f957a', [(43,333),(47,333),(45,335),(41,335)]),
])

paint('pelvis_repaint',
      [(42,176),(105,176),(111,186),(109,202),(98,215),(88,216),
       (78,211),(73,210),(68,217),(51,215),(44,204),(41,191)], [
    ('#1d262a', []),
    ('#24332e', [(46,181),(66,183),(74,192),(74,202),(65,213),(52,212),(47,199)]),
    ('#222e2b', [(80,184),(101,181),(108,187),(106,199),(96,211),(88,212),(82,201)]),
    ('#1a2025', [(44,178),(104,178),(107,184),(89,190),(68,189),(46,185)]),
    ('#364735', [(51,188),(58,190),(60,205),(56,208),(54,201)]),
])

# Recorder-side arm is redrawn as sleeve volumes rather than rotating the old
# hand-on-hip picture. Preserve the source head, jacket and opposite arm.
paint('recorder_sleeve_repaint',
      [(108,75),(118,79),(125,94),(132,113),(139,134),(138,148),
       (135,162),(132,178),(125,183),(117,179),(119,169),(122,153),
       (124,139),(119,123),(114,108),(108,96),(105,84)], [
    ('#763522', []),
    ('#91492d', [(110,78),(116,81),(123,97),(127,113),(134,135),(132,149),(129,164),(126,177),(120,178),(122,165),(127,143),(126,134),(120,116),(114,100),(108,88)]),
    ('#ab603c', [(110,80),(114,82),(119,93),(122,104),(124,116),(121,113),(117,102),(112,94),(108,87)]),
    ('#612b21', [(126,108),(131,118),(138,133),(136,150),(134,164),(131,175),(128,177),(130,160),(132,142),(130,133)]),
    ('#ab603c', [(127,143),(131,142),(132,148),(128,165),(125,174),(122,175),(124,162)]),
    ('#4b1f15', [(125,130),(126,127),(130,131),(133,137),(131,141),(127,138)]),
    ('#91492d', [(130,130),(134,131),(136,136),(135,140),(132,138)]),
    ('#201618', [(119,173),(123,175),(130,176),(132,179),(128,184),(121,182),(117,179)]),
])

stack.append(('source_jacket_overlap', art.underpaint.copy()))
paint('jacket_hidden_device_area_repaint',
      [(88,140),(109,139),(115,149),(114,177),(105,184),(88,180)], [
    ('#733d25', []),
    ('#8d4b27', [(92,143),(106,143),(109,154),(107,175),(101,181),(90,178)]),
    ('#542c20', [(110,147),(113,148),(112,175),(108,178),(108,169)]),
    ('#a25b2c', [(99,155),(101,153),(103,158),(103,169),(100,172)]),
])
stack.append(('source_case_arm', art.layers['arm_R'].copy()))
stack.append(('source_head_and_jacket', art.layers['upper_body'].copy()))

# Crop only the device body. Source arm pixels do not become its new hand.
device = Image.new('RGBA', size)
device.alpha_composite(src['recorder_L'].crop((96,154,121,203)), (102,139))
stack.append(('source_device_body_repositioned', device))
paint('device_grip_repaint',
      [(120,177),(126,176),(130,180),(130,188),(126,194),(109,195),
       (102,191),(102,186),(108,184),(118,186),(121,182)], [
    ('#172626', []),
    ('#293e3c', [(123,178),(126,179),(127,184),(126,190),(122,192),(112,192),(105,189),(105,187),(111,187),(118,189),(123,186)]),
    ('#415a51', [(122,180),(124,179),(125,181),(124,185),(122,186),(121,184)]),
    ('#314941', [(104,187),(108,186),(111,187),(113,189),(111,191),(107,190),(104,189)]),
    ('#536b5d', [(105,187),(108,187),(109,188),(108,189),(105,188)]),
])
stack += [('source_case', src['toolbox_R'].copy()), ('source_case_hand', src['glove_R'].copy())]

result = Image.new('RGBA', size)
for name, im in stack:
    result.alpha_composite(im)
    im.save(out/(name+'.png'))
result.save(out/'support-repaint.png')
source.save(out/'source-reference.png')

root = Element('image', {'w': str(size[0]), 'h': str(size[1]), 'version':'0.0.3'})
tree = SubElement(root, 'stack')
with zipfile.ZipFile(out/'support-repaint.ora', 'w') as z:
    z.writestr('mimetype','image/openraster',compress_type=zipfile.ZIP_STORED)
    for i,(name,im) in reversed(list(enumerate(stack))):
        path=f'data/layer-{i:02}.png';data=io.BytesIO();im.save(data,format='PNG')
        z.writestr(path,data.getvalue())
        SubElement(tree,'layer',{'name':name,'src':path,'x':'0','y':'0','opacity':'1','visibility':'visible','composite-op':'svg:src-over'})
    z.writestr('stack.xml',tostring(root,encoding='utf-8'))
    b=io.BytesIO();result.save(b,format='PNG');z.writestr('mergedimage.png',b.getvalue())

(out/'paint-shapes.json').write_text(json.dumps({'source':str(source_path.relative_to(ROOT)),
    'sourceSha256':hashlib.sha256(source_path.read_bytes()).hexdigest(), 'canvas':size,
    'method':'Explicit code-authored raster paint polygons on new garment, boot and grip layers; original head/jacket/case retained. No cloth texture warp.',
    'shapes':shapes},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',19)
small=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',14)
review=Image.new('RGB',(1080,950),'#e1e5d7');d=ImageDraw.Draw(review)
failed=Image.open(ROOT/'prototypes/visual-direction/actor-whole-pose-v02/frame-012.png').convert('RGBA').crop((52,26,208,374))
for i,(title,caption,im) in enumerate([
    ('原画 · 身份与光色参照','原有持物站姿，不作为动作参考',source),
    ('撤回 · 第13帧','腿形收窄，踝鞋扭折，承重不清',failed),
    ('结构草稿 · 未过画风','重画腿脚；手掌改为托住设备底部',result),
]):
    x=i*360
    d.text((x+18,15),title,font=font,fill='#244238')
    d.text((x+18,48),caption,font=small,fill='#536855')
    large=im.resize((312,696),Image.Resampling.NEAREST)
    review.paste(large,(x+24,82),large)
    d.line((x+18,795,x+342,795),fill='#bdc7b5')
    d.text((x+18,807),'约104px场景尺寸',font=small,fill='#536855')
    reduced=im.resize((47,104),Image.Resampling.NEAREST)
    review.paste(reduced,(x+157,836),reduced)
review.save(out/'support-comparison.png')
(out/'review-status.json').write_text(json.dumps({
    'status':'internal complete-pose repaint experiment; visual review pending',
    'staticOnly':True,'artApproved':False,'walkingApproved':False,'homepageIntegrated':False,
    'retained':'Source head/jacket, opposite arm and case; device body repositioned.',
    'changed':'Both trouser legs and boots, pelvis, recorder-side sleeve and glove are new explicit raster paint.',
    'limits':['Code-authored repaint may be flatter than source painting.','This is a two-foot standing posture, not a single-support walking keyframe.','No natural motion or physical balance claim.']
},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'out':str(out),'layers':len(stack),'canvas':size},ensure_ascii=False))
