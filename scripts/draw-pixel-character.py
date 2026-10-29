"""Author a complete raster sprite from explicit pixel-cluster brush commands.

This is program-assisted 2D drawing, not AI generation or human hand painting.
No input image pixels, textures, 3D render, limb transforms or noise are used.
The OpenRaster file keeps the drawing layers editable in Krita/GIMP.
"""
from pathlib import Path
from io import BytesIO
import hashlib
import json
import zipfile
from xml.etree.ElementTree import Element,SubElement,tostring
from PIL import Image,ImageDraw,ImageFont

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'prototypes/visual-direction/pixel-character-media'
OUT.mkdir(parents=True,exist_ok=True)
PALETTE={
 'ink':'#192b2c','deep':'#24342e','hair':'#1e2a26','hairmid':'#354331','hairlight':'#596345','hairglint':'#909269',
 'skinshade':'#795f43','skinside':'#a77f54','skin':'#ce9f6b','skinwarm':'#e3b77d','skinlight':'#efd197','skinshine':'#f6dfaa',
 'beard':'#4f4c36','beardlight':'#746445','eye':'#28352b','eyelight':'#d7c690',
 'coatdeep':'#4d4632','coatshadow':'#6e4a2b','coatrusset':'#97552a','coat':'#bb6d2c','coatwarm':'#d88b34','coatlight':'#e9a344','coatsun':'#f2bc5e','coatglint':'#f5d283','coatcool':'#676b41',
 'clothdeep':'#26382e','clothshadow':'#344530','cloth':'#465639','clothlight':'#637044','clothsun':'#82875a','clothglint':'#a0a373',
 'bootdeep':'#1b2b29','boot':'#2c3c32','bootlight':'#46513b','bootglint':'#73775a','rubber':'#182928',
 'metalshade':'#50665e','metalside':'#70877b','metal':'#a7b6a1','metallight':'#d8dfc3','metalglint':'#edf0d2',
 'device':'#355a49','deviceshade':'#263f36','devicelight':'#58806a','screen':'#9dbb9a','screenlight':'#d3dfb4','button':'#cab37b',
}
layers=[];commands=[]
def layer(name):
    canvas=Image.new('RGBA',(128,196));layers.append((name,canvas));commands.append({'name':name,'operations':[]})
    return ImageDraw.Draw(canvas)
def P(points,color):
    draw.polygon(points,fill=PALETTE[color]);commands[-1]['operations'].append({'polygon':points,'color':color})
def L(points,color,width=1):
    draw.line(points,fill=PALETTE[color],width=width);commands[-1]['operations'].append({'line':points,'color':color,'width':width})
def R(box,color):
    draw.rectangle(box,fill=PALETTE[color]);commands[-1]['operations'].append({'rectangle':box,'color':color})

# One coherent pose. Far leg and right loaded arm are behind the torso.
draw=layer('01 Far leg and work boot')
P([(54,107),(67,109),(68,124),(63,139),(60,151),(59,167),(58,179),(56,184),(46,184),(47,174),(48,160),(48,150),(51,134)],'clothdeep')
P([(54,116),(62,119),(62,133),(57,146),(55,155),(55,169),(52,180),(48,180),(49,162),(50,151),(53,136)],'cloth')
P([(55,125),(59,125),(57,140),(53,151),(51,164),(50,174),(49,176),(50,154),(52,143)],'clothlight')
P([(53,149),(57,146),(58,150),(56,155),(52,157)],'clothshadow')
L([(49,174),(52,175),(55,173)],'clothlight')
P([(47,179),(57,179),(58,185),(56,188),(43,189),(38,188),(38,186),(42,184),(46,183)],'bootdeep')
P([(47,181),(53,181),(54,185),(47,187),(39,187),(43,185),(47,184)],'boot')
L([(39,186),(43,185),(47,185)],'bootlight')
L([(39,188),(45,189),(55,188)],'rubber')
L([(48,181),(53,181)],'bootglint')

draw=layer('02 Trousers and near boot')
P([(62,107),(79,108),(80,120),(78,135),(76,144),(76,153),(77,165),(75,180),(73,185),(63,185),(62,180),(64,166),(64,155),(62,148),(63,136),(60,124)],'clothshadow')
P([(65,114),(76,115),(76,128),(73,140),(71,149),(72,158),(72,170),(70,181),(64,181),(66,167),(66,156),(64,147),(65,134)],'cloth')
P([(66,115),(70,116),(69,128),(67,139),(66,145),(65,142),(66,131)],'clothlight')
P([(72,121),(76,122),(75,132),(72,140),(70,146),(69,145),(70,134)],'clothshadow')
P([(65,147),(70,144),(73,146),(73,149),(68,151),(66,157)],'clothlight')
P([(65,155),(68,153),(67,164),(65,173),(64,177),(65,165)],'clothsun')
P([(72,152),(75,152),(75,164),(73,175),(72,180),(70,180),(72,168)],'clothdeep')
P([(65,175),(68,178),(72,177),(72,181),(67,183),(63,182)],'clothshadow')
L([(64,180),(67,179),(70,180)],'clothlight')
L([(65,150),(68,149),(71,149)],'clothsun')
R((66,150,67,150),'clothglint')
P([(63,182),(73,182),(74,186),(74,190),(70,192),(55,192),(51,191),(51,188),(56,187),(61,186)],'bootdeep')
P([(64,183),(70,183),(70,187),(67,189),(54,190),(52,189),(58,188),(63,186)],'boot')
P([(61,187),(66,186),(67,188),(63,189),(56,189),(54,190),(52,189),(57,188)],'bootlight')
L([(64,184),(68,184)],'bootglint')
L([(52,191),(59,192),(70,192),(73,190)],'rubber')
L([(54,190),(58,190)],'bootglint')

draw=layer('03 Neck and far sleeve')
P([(63,38),(73,37),(74,47),(70,52),(59,51),(60,45),(64,43)],'skinshade')
P([(64,39),(69,38),(70,46),(66,49),(61,48),(63,44)],'skin')
P([(64,41),(68,40),(67,46),(64,47)],'skinlight')
P([(55,49),(61,53),(58,67),(56,82),(53,97),(50,108),(43,107),(44,99),(47,83),(47,70),(50,57)],'coatshadow')
P([(53,54),(57,54),(55,65),(53,82),(50,96),(48,103),(45,103),(48,85),(49,70),(51,61)],'coat')
P([(52,59),(54,59),(52,73),(51,83),(48,93),(47,96),(49,79),(50,67)],'coatlight')
P([(48,94),(52,92),(51,97),(48,101),(45,100)],'coatrusset')
L([(45,104),(49,105),(51,103)],'coatcool')

draw=layer('04 Work coat volume and folds')
P([(58,46),(64,48),(72,46),(77,48),(81,54),(82,65),(80,81),(80,96),(81,108),(78,113),(57,113),(52,110),(52,100),(51,89),(53,74),(53,60),(55,52)],'coatrusset')
P([(58,49),(65,51),(72,49),(77,52),(78,65),(75,78),(76,91),(77,105),(74,110),(56,110),(54,105),(54,93),(53,89),(56,72),(55,61)],'coat')
P([(58,50),(63,52),(67,53),(65,60),(61,66),(60,79),(58,88),(58,97),(61,106),(59,110),(55,109),(54,99),(54,91),(55,80),(56,67),(56,57)],'coatwarm')
P([(58,51),(62,52),(61,58),(58,66),(58,75),(56,79),(55,75),(56,64),(56,57)],'coatlight')
P([(62,53),(68,52),(73,50),(77,52),(77,55),(71,55),(66,57),(63,57)],'coatlight')
L([(62,53),(66,53),(70,52),(74,52)],'coatsun')
R((62,54,64,54),'coatglint')
P([(73,58),(77,58),(78,66),(75,75),(75,87),(78,97),(78,108),(74,111),(72,104),(73,94),(71,81)],'coatrusset')
P([(77,62),(80,62),(80,71),(78,79),(77,91),(79,100),(79,109),(77,111),(76,102),(76,88),(74,78)],'coatshadow')
# Chest pocket follows the front plane; short top seam, not an outlined box.
P([(61,64),(70,63),(71,68),(70,76),(63,78),(61,75)],'coatrusset')
P([(62,65),(69,65),(69,72),(66,75),(63,75)],'coatwarm')
P([(62,65),(70,64),(70,66),(65,67),(62,67)],'coatlight')
L([(63,66),(68,65)],'coatsun')
R((68,67,68,68),'coatshadow')
L([(64,76),(67,76)],'coatshadow')
# Folds gather at the waist, pocket corner and under the loaded shoulder.
P([(58,78),(61,80),(62,85),(60,89),(57,91),(55,89),(57,85)],'coatrusset')
P([(56,84),(58,83),(59,85),(57,89),(55,88)],'coatlight')
P([(62,82),(67,80),(72,80),(70,82),(65,84),(62,87),(61,86)],'coatshadow')
P([(63,85),(67,83),(70,83),(68,86),(64,87)],'coatwarm')
P([(58,92),(62,93),(67,91),(70,93),(66,97),(61,98),(58,96)],'coatlight')
P([(59,95),(62,96),(65,96),(62,98),(58,98)],'coatsun')
P([(65,98),(70,96),(74,98),(73,102),(68,104),(65,103)],'coatrusset')
L([(67,100),(70,99),(73,100)],'coatwarm')
P([(56,101),(60,102),(63,107),(66,108),(66,110),(59,109),(56,107)],'coatwarm')
P([(57,110),(65,111),(73,110),(78,109),(78,112),(74,114),(58,113),(54,111)],'coatshadow')
L([(57,110),(61,111),(66,111)],'coatsun')
L([(69,111),(74,111)],'coatwarm')
# Standing collar and a closed narrow placket.
P([(57,45),(61,44),(65,47),(70,47),(73,44),(76,45),(76,49),(71,52),(65,52),(60,49),(56,49)],'coatshadow')
P([(58,45),(61,45),(64,48),(69,49),(69,51),(63,50),(58,48)],'coatlight')
L([(58,45),(60,45),(63,47)],'coatsun')
P([(72,45),(74,44),(75,45),(74,48),(71,49)],'coat')
L([(57,50),(56,65),(55,80),(55,94),(56,108)],'coatshadow')
L([(58,51),(57,65),(56,79),(56,91),(57,106)],'coatsun')
R((57,54,58,56),'metalshade')
R((58,54,58,55),'metal')

draw=layer('05 Near sleeve and recorder hand')
P([(74,50),(80,51),(85,57),(87,65),(89,76),(88,83),(84,91),(79,98),(75,104),(70,103),(70,98),(75,91),(79,83),(78,76),(75,68)],'coatshadow')
P([(75,53),(80,54),(83,60),(85,70),(86,78),(84,84),(80,91),(75,99),(72,100),(73,96),(78,89),(81,82),(80,75),(77,67)],'coat')
P([(76,54),(80,56),(82,62),(83,69),(82,75),(80,74),(78,64)],'coatlight')
L([(77,55),(79,57),(80,61)],'coatsun')
P([(83,63),(86,70),(87,78),(85,84),(82,86),(82,83),(84,78),(83,72)],'coatrusset')
P([(81,81),(84,80),(83,84),(79,87),(77,89),(77,87)],'coatwarm')
L([(81,83),(83,82)],'coatsun')
P([(80,87),(82,88),(78,94),(75,98),(72,99),(74,95),(77,91)],'coatlight')
P([(76,96),(79,96),(77,101),(74,104),(70,103),(70,100),(73,101)],'coatdeep')
L([(71,99),(74,100),(76,98)],'coatcool')
# Relaxed left hand curls around the recorder's edge.
P([(70,101),(75,103),(76,108),(73,113),(69,112),(67,108),(67,104)],'skinshade')
P([(69,102),(73,103),(74,106),(72,110),(69,110),(68,107)],'skin')
L([(69,103),(72,104),(72,106)],'skinlight')

draw=layer('06 Toolbox and right grip')
# The far right hand is visible at the forward edge of the coat.
P([(43,106),(49,107),(50,111),(48,116),(43,117),(41,113),(41,110)],'skinshade')
P([(43,107),(47,108),(48,111),(46,114),(43,114),(42,111)],'skin')
L([(43,108),(46,109),(46,111)],'skinlight')
# Handle sits inside the right fingers; two supports meet the lid.
P([(39,117),(40,112),(42,110),(47,110),(49,112),(49,118),(46,119),(46,114),(43,114),(42,118)],'deep')
L([(40,116),(41,113),(42,112)],'metalshade')
L([(43,111),(46,111)],'metal')
R((42,112,43,114),'skinwarm')
R((44,112,45,114),'skin')
R((46,112,47,113),'skinside')
P([(34,120),(39,117),(52,118),(55,121),(55,140),(51,144),(35,142),(33,139)],'metalshade')
P([(34,121),(38,120),(50,121),(50,141),(35,140),(34,138)],'metal')
P([(50,121),(54,120),(54,139),(51,142),(50,140)],'metalside')
P([(35,119),(39,117),(51,118),(54,120),(49,122),(35,121)],'metallight')
L([(35,122),(48,123)],'metallight')
L([(34,124),(48,125)],'metalside')
L([(35,137),(36,139),(48,140)],'metalside')
R((37,124,39,127),'metalshade')
R((38,124,39,125),'metallight')
R((45,125,47,128),'metalshade')
R((46,125,47,126),'metallight')
R((34,122,34,126),'metalglint')
L([(36,139),(40,140)],'metallight')

draw=layer('07 Left recorder and finger contact')
P([(67,106),(75,107),(76,110),(75,125),(73,127),(66,126),(65,122),(66,110)],'deviceshade')
P([(67,108),(73,109),(73,124),(67,123)],'device')
L([(66,111),(66,121),(67,124)],'devicelight')
P([(68,110),(72,110),(72,115),(68,115)],'screen')
L([(68,110),(71,110)],'screenlight')
R((69,112,71,113),'devicelight')
R((68,118,69,119),'button')
R((71,118,72,119),'screen')
R((68,122,71,122),'devicelight')
P([(73,107),(75,107),(75,112),(74,114),(73,113)],'skinside')
L([(74,108),(74,111)],'skinlight')
L([(66,105),(66,108),(67,109)],'skinshade')

draw=layer('08 Face, short stubble and hair')
P([(59,24),(66,21),(72,23),(76,27),(76,33),(74,38),(70,42),(65,45),(59,44),(55,41),(54,38),(52,37),(52,35),(54,33),(54,28)],'skinside')
P([(59,25),(65,24),(69,26),(70,31),(68,36),(66,40),(61,42),(57,40),(56,37),(53,36),(55,33),(56,28)],'skin')
P([(57,27),(61,26),(63,27),(62,30),(58,32),(55,33),(56,30)],'skinlight')
P([(56,33),(58,33),(57,35),(55,36),(53,36),(54,34)],'skinwarm')
R((53,35,54,35),'skinshine')
P([(59,34),(63,33),(65,35),(64,38),(60,39),(57,38),(57,36)],'skinwarm')
L([(60,35),(62,35),(63,36)],'skinlight')
P([(66,27),(70,28),(72,32),(70,36),(68,39),(65,41),(64,39),(66,36)],'skinside')
P([(70,31),(73,31),(75,33),(74,36),(72,38),(70,37),(69,34)],'skinshade')
P([(71,32),(73,32),(73,35),(71,36),(70,34)],'skinwarm')
R((72,33,72,34),'skinside')
P([(56,39),(59,40),(62,41),(66,39),(68,37),(69,37),(68,41),(65,44),(60,44),(57,42)],'beard')
P([(58,40),(61,41),(64,42),(66,41),(65,43),(60,43),(58,42)],'beardlight')
R((59,40,60,40),'skin')
L([(55,38),(58,38)],'skinshade')
R((55,39,56,39),'skinlight')
# Brow and a visible leftward eye; no oversized separate eye or head layer scale.
L([(54,31),(56,30),(59,30)],'beard')
R((55,32,57,32),'eye')
R((54,32,54,32),'eyelight')
R((58,32,58,33),'skinside')
R((56,33,57,33),'skinwarm')
# Short hair is a compact mass with a few chosen sunlit clusters.
P([(57,25),(56,23),(58,20),(61,19),(62,17),(67,17),(69,18),(73,18),(75,20),(77,21),(78,25),(78,30),(76,33),(74,34),(73,31),(71,30),(70,26),(66,25),(62,25),(59,27),(58,29),(57,29)],'hair')
P([(58,22),(61,20),(66,19),(70,19),(74,21),(76,24),(74,25),(70,23),(65,23),(61,24),(58,25)],'hairmid')
P([(60,20),(63,19),(67,19),(68,20),(65,21),(61,22),(59,23)],'hairlight')
L([(62,19),(65,19)],'hairglint')
R((59,21,60,21),'hairglint')
P([(74,25),(77,26),(77,30),(75,32),(73,31),(72,28)],'deep')
L([(75,28),(75,30)],'hairmid')
P([(69,29),(71,30),(71,34),(69,37),(68,37),(69,33)],'beard')

composite=Image.new('RGBA',(128,196))
for _,canvas in layers:composite.alpha_composite(canvas)
composite.save(OUT/'pixel-stance-v04.png')
composite.resize((384,588),Image.Resampling.NEAREST).save(OUT/'pixel-stance-v04-3x.png')
authoring={'revision':'pixel04','method':'Complete program-assisted 2D raster drawing with authored pixel-cluster brush commands; not human hand painting.','canvas':[128,196],'palette':PALETTE,'layers':commands,'sourceImagePixelsUsed':False,'textureSampling':False,'threeDRenderPixelsUsed':False,'randomNoise':False,'localBodyTransforms':False}
(OUT/'pixel-stance-v04-authoring.json').write_text(json.dumps(authoring,ensure_ascii=False,indent=2),encoding='utf8')
root=Element('image',{'version':'0.0.3','w':'128','h':'196','name':'Complete pixel character trial 04'})
stack=SubElement(root,'stack')
with zipfile.ZipFile(OUT/'pixel-stance-v04.ora','w',compression=zipfile.ZIP_DEFLATED) as archive:
    archive.writestr('mimetype','image/openraster',compress_type=zipfile.ZIP_STORED)
    for index,(name,canvas) in reversed(list(enumerate(layers))):
        filename=f'data/layer{index:02}.png';buffer=BytesIO();canvas.save(buffer,format='PNG');archive.writestr(filename,buffer.getvalue())
        SubElement(stack,'layer',{'name':name,'src':filename,'opacity':'1.0','visibility':'visible','composite-op':'svg:src-over','x':'0','y':'0'})
    archive.writestr('stack.xml',tostring(root,encoding='utf-8',xml_declaration=True))
    buffer=BytesIO();composite.save(buffer,format='PNG');archive.writestr('mergedimage.png',buffer.getvalue())
    buffer=BytesIO();composite.save(buffer,format='PNG');archive.writestr('Thumbnails/thumbnail.png',buffer.getvalue())
pixels=list(composite.get_flattened_data());visible=[p for p in pixels if p[3]]
report={'revision':'pixel04','status':'complete raster drawing trial; art not approved','artApproved':False,'sourceImagePixelsUsed':False,'bodyTransforms':False,'nativeCanvas':[128,196],'alphaBounds':composite.getbbox(),'paletteColorsUsed':len(set(visible)),'layers':len(layers),'brushCommands':sum(len(x['operations']) for x in commands),'sha256':hashlib.sha256((OUT/'pixel-stance-v04.png').read_bytes()).hexdigest(),'generatedCandidate':{'file':'pixel-stance-v03_001.jpg','provider':'MMX image-01','seed':281301,'selected':False,'reasons':['Smooth 3D instead of pixel painting','Added hood and changed beard/proportions','Equipment changes side','Not a flat backdrop']},'limitations':['Identity and pixel style require full-person art review.','No animation, other facing direction or production integration.','Layered authoring is not a ready animation rig.']}
(OUT/'pixel-stance-v04.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps(report,indent=2),flush=True)
