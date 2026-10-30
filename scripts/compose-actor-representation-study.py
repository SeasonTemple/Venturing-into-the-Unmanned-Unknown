"""Composite actual offline person renders onto the existing clean meadow plate."""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('directory',type=Path)
args=parser.parse_args();directory=args.directory.resolve()
study=json.loads((directory/'study.json').read_text(encoding='utf-8'))
plate_path=ROOT/'prototypes/visual-direction/meadow-media/walk-plate-v01.webp'
plate=Image.open(plate_path).convert('RGBA')
foot=(1120,887)  # An existing station-to-measuring-point route position.
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',22)
small=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',15)
report={'plate':str(plate_path.relative_to(ROOT)),'plateSize':plate.size,
        'worldRouteFootpoint':foot,'spriteScale':1,'contactShadow':'2D compositing cue, not physical shadow simulation',
        'views':[]}
review=Image.new('RGB',(1920,990),'#e1e5d7')
draw=ImageDraw.Draw(review)
native=Image.new('RGB',(1000,1010),'#e1e5d7');nd=ImageDraw.Draw(native)
for i,record in enumerate(study['frames']):
    name=record['pose'];person=Image.open(directory/(name+'.png')).convert('RGBA')
    x=round(foot[0]-record['anchor'][0]);y=round(foot[1]-record['anchor'][1])
    frame=plate.copy()
    shadow=Image.new('RGBA',plate.size);sd=ImageDraw.Draw(shadow)
    sd.ellipse((foot[0]-19,foot[1]-3,foot[0]+25,foot[1]+5),fill=(26,49,39,60))
    frame.alpha_composite(shadow);frame.alpha_composite(person,(x,y))
    frame.convert('RGB').save(directory/('scene-'+name+'.png'))
    frame.convert('RGB').save(directory/('scene-'+name+'.webp'),quality=94)
    # Native scene files remain 1920x1080. The overview is a uniformly reduced
    # contact sheet; the crop below it retains one-to-one scene pixels.
    thumb=frame.convert('RGB').resize((960,540),Image.Resampling.LANCZOS)
    review.paste(thumb,(i*960,64))
    title='01 · 站立持物' if i==0 else '02 · 整体转向35°'
    draw.text((i*960+22,15),title,font=font,fill='#244238')
    crop=frame.crop((890,640,1370,960)).convert('RGB')
    review.paste(crop,(i*960+40,620))
    draw.text((i*960+550,640),'下图：场景像素1:1',font=small,fill='#536855')
    draw.text((i*960+550,672),'同一镜头、同一模型',font=small,fill='#536855')
    draw.text((i*960+550,704),'角色转向；装备未镜像',font=small,fill='#536855')
    draw.text((i*960+550,736),'静态呈现试验，非行走资产',font=small,fill='#536855')
    zoom=person.resize((480,672),Image.Resampling.NEAREST)
    native.paste(zoom,(i*500+10,54),zoom)
    nd.text((i*500+18,14),title,font=font,fill='#244238')
    nd.text((i*500+18,740),'下：原生160×224画布',font=small,fill='#536855')
    native.paste(person,(i*500+170,765),person)
    report['views'].append({'pose':name,'paste':[x,y],'visibleBounds':person.getbbox(),'sourceFrame':record['frame']})
review.save(directory/'scene-review.png')
native.save(directory/'native-review.png')
if all((directory/('before-'+r['pose']+'.png')).exists() for r in study['frames']):
    comparison=Image.new('RGB',(1600,610),'#e1e5d7')
    cd=ImageDraw.Draw(comparison)
    for i,r in enumerate(study['frames']):
        for j,prefix in enumerate(['before-','']):
            x=(i*2+j)*400
            title=('修订前' if prefix else study.get('comparisonTitle','肩颈与站距修正'))+(' · 正面' if i==0 else ' · 转向')
            cd.text((x+18,18),title,font=font,fill='#244238')
            sprite=Image.open(directory/(prefix+r['pose']+'.png')).convert('RGBA')
            sprite=sprite.resize((320,448),Image.Resampling.NEAREST)
            comparison.paste(sprite,(x+40,60),sprite)
            cd.text((x+18,535),'同镜头 / 同光照 / 2倍整数放大',font=small,fill='#536855')
    cd.text((18,578),study.get('comparisonFooter','静态母版修正；人物身份、握持与最终画风仍待验收。'),font=small,fill='#536855')
    comparison.save(directory/'standing-before-after.png')
(directory/'placement.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Composited both offline orientations at 1x sprite scale onto the same meadow plate.')
