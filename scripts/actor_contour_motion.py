"""Finite authored contour transitions, articulated loaded arms and contact locks.

Called by author-actor-contour-poses.py. Uses the same shared cloth master;
does not load the rejected planar leg rig or its bone/skin weights.
"""
import hashlib
import json
import math
import shutil
import subprocess
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont


def mix(a, b, t):
    return a+(b-a)*t


def smooth(a, b, x):
    t = max(0, min(1, (x-a)/(b-a)))
    return t*t*(3-2*t)


def pchip(points, x):
    """Shape-preserving travel; passing poses do not force speed to zero."""
    if x <= points[0][0]:
        return points[0][1]
    if x >= points[-1][0]:
        return points[-1][1]
    hs = [b[0]-a[0] for a,b in zip(points, points[1:])]
    ds = [(b[1]-a[1])/h for a,b,h in zip(points, points[1:], hs)]
    slopes = [0.0]*len(points)
    for i in range(1, len(points)-1):
        if ds[i-1]*ds[i] > 0:
            w1, w2 = 2*hs[i]+hs[i-1], hs[i]+2*hs[i-1]
            slopes[i] = (w1+w2)/(w1/ds[i-1]+w2/ds[i])
    for i,(a,b) in enumerate(zip(points, points[1:])):
        if a[0] <= x <= b[0]:
            t = (x-a[0])/(b[0]-a[0])
            return ((2*t**3-3*t*t+1)*a[1] + (t**3-2*t*t+t)*hs[i]*slopes[i]
                    + (-2*t**3+3*t*t)*b[1] + (t**3-t*t)*hs[i]*slopes[i+1])


def rotate(point, pivot, angle):
    c, s = math.cos(math.radians(angle)), math.sin(math.radians(angle))
    x,y = point[0]-pivot[0], point[1]-pivot[1]
    return [pivot[0]+c*x-s*y, pivot[1]+s*x+c*y]


def build_motion(recipe, out, art):
    motion = recipe['motion']
    keys = motion['keys']
    fps = motion['fps']
    last = keys[-1]['frame']
    ox, oy = art.offset
    poses = {p['name']: p for p in recipe['poses']}
    font_path = Path('C:/Windows/Fonts/msyh.ttc')
    font = ImageFont.truetype(str(font_path), 18) if font_path.exists() else ImageFont.load_default(size=18)
    small = ImageFont.truetype(str(font_path), 13) if font_path.exists() else ImageFont.load_default(size=13)
    frame_dir = out/'frames'
    frame_dir.mkdir()
    # Extend jacket artwork under its adjoining sleeves before independent
    # shoulder motion. The original arm pixels cover this overlap at rest.
    underpaint=Image.new('RGBA',art.original.size)
    torso_src=art.layers['upper_body'].copy()
    arm_sources={side:art.layers['arm_'+side].copy() for side in ['R','L']}
    # Pixel ownership along the source sleeve edge can leave tiny detached
    # jacket islands. They must follow their sleeve instead of a different
    # deformation field; increasing overlap cannot repair that assignment.
    remaining={(x,y) for y in range(torso_src.height) for x in range(torso_src.width)
               if torso_src.getpixel((x,y))[3]}
    components=[]
    while remaining:
        seed=remaining.pop();component=[seed];todo=[seed]
        while todo:
            x,y=todo.pop()
            for dx in [-1,0,1]:
                for dy in [-1,0,1]:
                    point=(x+dx,y+dy)
                    if point in remaining:
                        remaining.remove(point);component.append(point);todo.append(point)
        components.append(component)
    ownership_transfers=[]
    for component in components:
        if len(component)>8 or min(y for x,y in component)<70:
            continue
        scores={side:sum(0<=x+dx<torso_src.width and 0<=y+dy<torso_src.height
                        and bool(arm_sources[side].getpixel((x+dx,y+dy))[3])
                        for x,y in component for dx in range(-2,3) for dy in range(-2,3))
                for side in ['R','L']}
        side=max(scores,key=scores.get)
        if scores[side]:
            for x,y in component:
                arm_sources[side].putpixel((x,y),torso_src.getpixel((x,y)))
                torso_src.putpixel((x,y),(0,0,0,0))
            ownership_transfers.append({'to':'arm_'+side,'pixels':component})
    supplied=recipe.get('upperUnderpaint')
    if supplied:
        underpaint=Image.open(Path(__file__).resolve().parents[1]/supplied).convert('RGBA')
        if underpaint.size!=art.original.size:
            raise ValueError('Keep shared jacket underpainting at original canvas size')
    else:
        for y in range(70,180):
            if not torso_src.getpixel((78,y))[3]:
                continue
            lo=hi=78
            while lo>0 and torso_src.getpixel((lo-1,y))[3]:lo-=1
            while hi<torso_src.width-1 and torso_src.getpixel((hi+1,y))[3]:hi+=1
            for side,edge,direction in [('R',lo,-1),('L',hi,1)]:
                for step in range(1,(13 if y<96 else 7)):
                    x=edge+step*direction
                    if not 0<=x<torso_src.width or not arm_sources[side].getpixel((x,y))[3]:
                        break
                    sample_x=max(lo,min(hi,edge-direction*2))
                    underpaint.putpixel((x,y),torso_src.getpixel((sample_x,y)))
    for y in range(underpaint.height):
        for x in range(underpaint.width):
            if underpaint.getpixel((x,y))[3] and not (
                    arm_sources['R'].getpixel((x,y))[3] or arm_sources['L'].getpixel((x,y))[3]):
                raise ValueError('Underpainting must stay behind source sleeve coverage')
    underpaint.save(out/'upper-underpaint.png')
    art.write_ora(out/'working-upper.ora',[
        ('hidden_jacket_overlap',underpaint),('continuous_torso_head',torso_src)])

    def interpolate(points, f, drift=0):
        if motion.get('periodic'):
            core=points[:-1]
            points=[(x+cycle*last,y+cycle*drift) for cycle in [-1,0,1,2]
                    for x,y in core]
        return pchip(points,f)

    def control(name, f):
        drift=keys[-1][name]-keys[0][name] if name in ['rootX','leftAnkleX','rightAnkleX'] else 0
        return interpolate([(k['frame'], k[name]) for k in keys], f, drift)

    def rigid(src, pivot, target, angle):
        c, s = math.cos(math.radians(angle)), math.sin(math.radians(angle))
        tx, ty = target[0]+ox, target[1]+oy
        return src.transform(art.size, Image.Transform.AFFINE,
            (c,s,pivot[0]-c*tx-s*ty,-s,c,pivot[1]+s*tx-c*ty),
            resample=Image.Resampling.NEAREST)

    def rest_y(side):
        return 254 if side == 'R' else 260

    def source_cuff(side):
        return 314 if side == 'R' else 321

    def endpoint_center(key, side, sy):
        if key['pose'] == 'source':
            lo,hi = art.row_run(art.cloth[side], round(sy))
            return (lo+hi+1)/2
        pose = poses[key['pose']][side]
        y0, yc = pose['center'][0][0], pose['center'][-1][0]
        yk = pose['kneeY']
        y = (mix(y0, yk, (sy-180)/(rest_y(side)-180)) if sy <= rest_y(side)
             else mix(yk, yc, (sy-rest_y(side))/(source_cuff(side)-rest_y(side))))
        return art.spline(pose['center'], y)

    def shape_center(side, sy, f):
        # Authored projected shapes, not fixed-length planar IK.
        return interpolate([(k['frame'], endpoint_center(k,side,sy)+k['rootX']) for k in keys], f,
                           keys[-1]['rootX']-keys[0]['rootX'])

    def custom_contact(side,f):
        return next((c for c in motion['contacts'][side] if c['from']<=f<=c['to']),None)

    def feet(f):
        if motion.get('contacts'):
            result={}
            for side in ['R','L']:
                angle=control('rightAngle' if side=='R' else 'leftAngle',f)
                contact=custom_contact(side,f)
                ankle=[control('rightAnkleX' if side=='R' else 'leftAnkleX',f),
                       control('rightAnkleY' if side=='R' else 'leftAnkleY',f)]
                if contact:
                    pivot=[58,319] if side=='R' else [104,328]
                    source=([30,337] if side=='R' else [90,347]) if contact['kind']=='toe' else ([66,337] if side=='R' else [113,347])
                    point=rotate(source,pivot,angle)
                    ankle=[pivot[i]+contact['anchor'][i]-point[i] for i in range(2)]
                result[side]={'ankle':ankle,'bootAngle':angle}
            return result
        ra = control('rightAngle', f)
        la = control('leftAngle', f)
        # Keep the same actual source toe in place through trailing-heel lift.
        if f <= motion.get('rightToeOffFrame',last):
            rtoe = rotate([30,337],[58,319],ra)
            r = [58+30-rtoe[0],319+337-rtoe[1]]
        elif f >= motion['rightContactFrame']:
            heel = rotate([66,337],[58,319],ra)
            anchor = motion['rightHeelAnchor']
            r = [58+anchor[0]-heel[0],319+anchor[1]-heel[1]]
        else:
            r = [control('rightAnkleX',f),control('rightAnkleY',f)]
        if f <= motion['toeOffFrame']:
            toe = rotate([90,347],[104,328],la)
            l = [104+90-toe[0],328+347-toe[1]]
        elif f > motion.get('leftRollFrame',last):
            toe = rotate([90,347],[104,328],la)
            anchor = motion['leftTrailingToeAnchor']
            l = [104+anchor[0]-toe[0],328+anchor[1]-toe[1]]
        elif f >= motion['leftContactFrame']:
            heel = rotate([113,347],[104,328],la)
            anchor = motion['leftHeelAnchor']
            l = [104+anchor[0]-heel[0],328+anchor[1]-heel[1]]
        else:
            l = [control('leftAnkleX',f), control('leftAnkleY',f)]
        return {'R':{'ankle':r,'bootAngle':ra},'L':{'ankle':l,'bootAngle':la}}

    def contact_anchor(side,f):
        if motion.get('contacts'):
            contact=custom_contact(side,f)
            return contact['anchor'] if contact else None
        if side=='R':
            if f <= motion.get('rightToeOffFrame',last):
                return [30,337]
            return motion['rightHeelAnchor'] if f>=motion['rightContactFrame'] else None
        if f<=motion['toeOffFrame']:
            return [90,347]
        if f<motion['leftContactFrame']:
            return None
        return (motion['leftTrailingToeAnchor'] if f>motion.get('leftRollFrame',last)
                else motion['leftHeelAnchor'])

    def contact_patch(side, f):
        """Return the source shoe pixel that is actually carrying contact.

        A rolling shoe may have its global bounding-box bottom above or below
        the contact point. The patch, rather than the whole shoe bbox, is the
        evidence used for a heel/forefoot/toe phase.
        """
        if motion.get('contacts'):
            contact = custom_contact(side, f)
            if not contact:
                return None
            if contact.get('patch'):
                return contact['patch']
            if contact.get('kind') == 'toe':
                return [30, 337] if side == 'R' else [90, 347]
            return [66, 337] if side == 'R' else [113, 347]
        if side == 'R':
            if f <= motion.get('rightToeOffFrame', last):
                return [30, 337]
            return [66, 337] if f >= motion['rightContactFrame'] else None
        if f <= motion['toeOffFrame']:
            return [90, 347]
        if f < motion['leftContactFrame']:
            return None
        return [90, 347] if f > motion.get('leftRollFrame', last) else [113, 347]

    def knee_y(side, f):
        return interpolate([(k['frame'], (rest_y(side) if k['pose']=='source' else poses[k['pose']][side]['kneeY'])) for k in keys], f)

    def trousers(side, f, foot, raster_shift):
        src = art.cloth[side]
        im = art.new_layer()
        hip_y = 180+round(control('bodyY',f))
        overlap=math.ceil(abs(math.sin(math.radians(control('torsoLean',f))))*60) if motion.get('linkedUpper') else 0
        ky = knee_y(side,f)
        offset = source_cuff(side) - (319 if side == 'R' else 328)
        cuff = rotate([foot['ankle'][0],foot['ankle'][1]+offset], foot['ankle'],foot['bootAngle'])
        cy = cuff[1]
        bottom_center = shape_center(side,source_cuff(side),f)-raster_shift
        for y in range(math.ceil(hip_y-overlap),math.floor(cy)+1):
            sy = (mix(180,rest_y(side),(y-hip_y)/(ky-hip_y)) if y<=ky
                  else mix(rest_y(side),source_cuff(side),(y-ky)/(cy-ky)))
            sy = max(180,min(source_cuff(side),sy))
            lo,hi = art.row_run(src,round(sy))
            cx = shape_center(side,sy,f)-raster_shift
            if motion.get('bodyArticulation'):
                cx += (control('hipSway',f)+control('bodyX',f))*(1-smooth(180,254,sy))
            cx += (cuff[0]-bottom_center)*smooth(rest_y(side)+12,source_cuff(side),sy)
            width = hi-lo+1
            x0 = round(round(cx-width/2,8)) if motion.get('canonicalRaster') else round(cx-width/2)
            for x in range(width):
                px,py = x0+x+ox,y+oy
                if 0<=px<im.width and 0<=py<im.height:
                    im.putpixel((px,py),src.getpixel((lo+x,round(sy))))
        return im

    def upper(f, root):
        body_x, body_y = control('bodyX',f), control('bodyY',f)
        lean = control('headLead',f)

        if motion.get('linkedUpper'):
            return linked_upper(f,root)
        if motion.get('bodyArticulation'):
            return articulated_upper(f,root)

        def torso_dx(y):
            # Head/neck/collar stay one raster translation; pose change starts
            # below the collar and continues through the jacket to the hips.
            return root+body_x+lean*(1-smooth(74,178,y))

        def jacket_pose(src):
            result=art.new_layer()
            for y in range(180):
                shift=round(torso_dx(y))
                row=src.crop((0,y,src.width,y+1))
                result.alpha_composite(row,(ox+shift,oy+round(body_y)+y))
            return result
        torso=jacket_pose(torso_src)
        overlap=jacket_pose(underpaint)

        shoulder_r = [47+torso_dx(84),84+body_y+control('shoulderDrop',f)]
        shoulder_l = [110+torso_dx(80),80+body_y]
        ar, al = control('rightArm',f), control('leftArm',f)
        right = rigid(arm_sources['R'],[47,84],shoulder_r,ar)
        left = rigid(arm_sources['L'],[110,80],shoulder_l,al)
        glove = rigid(art.layers['glove_R'],[47,84],shoulder_r,ar)
        grip0 = rotate([25,170],[47,84],ar)
        grip = [grip0[0]+shoulder_r[0]-47,grip0[1]+shoulder_r[1]-84]
        # Box has a world angle around its moving grip, independent of torso lean.
        box = rigid(art.layers['toolbox_R'],[25,170],grip,control('boxAngle',f))
        recorder = rigid(art.layers['recorder_L'],[110,80],shoulder_l,al)
        return [('hidden_jacket_overlap',overlap),('arm_R',right),('arm_L',left),('continuous_head_neck_jacket',torso),
                ('toolbox_R',box),('glove_R',glove),('recorder_L',recorder)]

    def articulated_upper(f,root):
        body_y=round(control('bodyY',f))
        head_x=round(root+control('bodyX',f)+control('headLead',f))
        hip_x=root+control('bodyX',f)+control('hipSway',f)
        chest=control('chestSway',f)
        roll=math.tan(math.radians(control('chestRoll',f)))

        def weight(y):
            return smooth(70,87,y)*(1-smooth(120,180,y))

        def dx(y):
            neck=1-smooth(74,178,y)
            return mix(hip_x,head_x,neck)+chest*weight(y)

        def point(p):
            x,y=p
            return [x+dx(y),y+body_y+roll*(x-78)*weight(y)]

        def inverse(x,y):
            tx,ty=x-ox,y-oy
            sx,sy=tx,ty-body_y
            for _ in range(5):
                sx=tx-dx(sy)
                sy=ty-body_y-roll*(sx-78)*weight(sy)
            return sx,sy

        # Inverse-sampled complete jacket, with no forward-scatter pinholes.
        # The face, neck and upper collar remain one unchanged raster island.
        mesh=[]
        x0=ox+math.floor(root)-16
        x1=ox+math.ceil(root)+art.original.width+16
        y0,y1=oy+body_y+70,oy+body_y+184
        for y in range(y0,y1,6):
            for x in range(x0,x1,12):
                right,bottom=min(x+12,x1),min(y+6,y1)
                quad=sum((inverse(px,py) for px,py in [(x,y),(x,bottom),(right,bottom),(right,y)]),())
                mesh.append(((x,y,right,bottom),quad))

        def jacket(src):
            lower=src.copy()
            ImageDraw.Draw(lower).rectangle((0,0,src.width,69),fill=(0,0,0,0))
            result=lower.transform(art.size,Image.Transform.MESH,mesh,resample=Image.Resampling.NEAREST)
            result.alpha_composite(src.crop((0,0,src.width,70)),(ox+head_x,oy+body_y))
            return result

        sr=point([47,84]);sr[1]+=control('shoulderDrop',f)
        sl=point([110,80])
        ar,al=control('rightArm',f),control('leftArm',f)
        bend=control('rightElbow',f)
        elbow=[33,120]
        rotated_elbow=rotate(elbow,[47,84],ar)
        target_elbow=[rotated_elbow[0]+sr[0]-47,rotated_elbow[1]+sr[1]-84]
        # An overlapping sleeve source preserves the elbow's material coverage.
        upper_src=arm_sources['R'].copy();ImageDraw.Draw(upper_src).rectangle((0,126,156,348),fill=(0,0,0,0))
        lower_src=arm_sources['R'].copy();ImageDraw.Draw(lower_src).rectangle((0,0,156,116),fill=(0,0,0,0))
        upper_arm=rigid(upper_src,[47,84],sr,ar)
        forearm=rigid(lower_src,elbow,target_elbow,ar+bend)
        glove=rigid(art.layers['glove_R'],elbow,target_elbow,ar+bend)
        grip_rotated=rotate([25,170],elbow,ar+bend)
        grip=[grip_rotated[i]+target_elbow[i]-elbow[i] for i in range(2)]
        box=rigid(art.layers['toolbox_R'],[25,170],grip,control('boxAngle',f))
        left=rigid(arm_sources['L'],[110,80],sl,al)
        recorder=rigid(art.layers['recorder_L'],[110,80],sl,al)
        return [('hidden_jacket_overlap',jacket(underpaint)),('arm_R_upper',upper_arm),
                ('arm_R_forearm',forearm),('arm_L',left),('continuous_head_neck_jacket',jacket(torso_src)),
                ('toolbox_R',box),('glove_R',glove),('recorder_L',recorder)]

    linked_records={}

    def linked_upper(f,root):
        # One rigid transform for the entire head, neck and jacket. There is no
        # chest-only translation window or separately pinned face raster.
        pivot=[78,174]
        target=[78+root+control('bodyX',f)+control('hipSway',f),174+round(control('bodyY',f))]
        angle=control('torsoLean',f)

        def body_point(p):
            q=rotate(p,pivot,angle)
            return [q[i]+target[i]-pivot[i] for i in range(2)]

        sr,sl=body_point([47,84]),body_point([110,80])
        ar,al=angle+control('rightArm',f),angle+control('leftArm',f)
        bend=control('rightElbow',f)
        elbow=[33,120]
        rotated_elbow=rotate(elbow,[47,84],ar)
        target_elbow=[rotated_elbow[i]+sr[i]-[47,84][i] for i in range(2)]
        upper_src=arm_sources['R'].copy();ImageDraw.Draw(upper_src).rectangle((0,126,156,348),fill=(0,0,0,0))
        lower_src=arm_sources['R'].copy();ImageDraw.Draw(lower_src).rectangle((0,0,156,116),fill=(0,0,0,0))
        upper_arm=rigid(upper_src,[47,84],sr,ar)
        forearm=rigid(lower_src,elbow,target_elbow,ar+bend)
        glove=rigid(art.layers['glove_R'],elbow,target_elbow,ar+bend)
        grip_rotated=rotate([25,170],elbow,ar+bend)
        grip=[grip_rotated[i]+target_elbow[i]-elbow[i] for i in range(2)]
        box=rigid(art.layers['toolbox_R'],[25,170],grip,control('boxAngle',f))
        left=rigid(arm_sources['L'],[110,80],sl,al)
        recorder=rigid(art.layers['recorder_L'],[110,80],sl,al)
        linked_records[f]={'pivot':pivot,'target':target,'angle':angle,
            'head':body_point([78,30]),'neck':body_point([78,70]),'chest':body_point([78,110]),
            'shoulderR':sr,'shoulderL':sl,'elbowR':target_elbow,'gripR':grip}
        return [('hidden_jacket_overlap',rigid(underpaint,pivot,target,angle)),
                ('arm_R_upper',upper_arm),('arm_R_forearm',forearm),('arm_L',left),
                ('continuous_head_neck_jacket',rigid(torso_src,pivot,target,angle)),
                ('toolbox_R',box),('glove_R',glove),('recorder_L',recorder)]

    records = []
    checks = {'headRasterIdenticalAfterTranslation': None if motion.get('linkedUpper') else True,
              'headNeckChestShareRigidTransform':bool(motion.get('linkedUpper')), 'footChecks': [],
              'checksProveAnatomyOrMotionQuality': False}
    for f in range(last+1):
        root = control('rootX',f)
        foot = feet(f)
        raster_shift=round(root) if motion.get('canonicalRaster') else 0
        local_foot={side:{'ankle':[round(p['ankle'][0]-raster_shift,8),p['ankle'][1]],'bootAngle':p['bootAngle']}
                    for side,p in foot.items()} if motion.get('canonicalRaster') else foot
        shadow = art.new_layer()
        draw = ImageDraw.Draw(shadow)
        boots={side:art.draw_boot(side,local_foot[side]) for side in ['R','L']}
        for side,boot in boots.items():
            bounds=boot.getbbox()
            anchor=contact_anchor(side,f)
            ground=337 if side=='R' else 348
            cx=(bounds[0]+bounds[2])/2
            width=(bounds[2]-bounds[0])*.8
            if anchor and abs(foot[side]['bootAngle'])>4:
                cx,width=anchor[0]+ox-raster_shift,10
            draw.ellipse((cx-width/2,ground+oy,cx+width/2,ground+oy+2),
                         fill='#8e9878' if anchor else '#bcc4ad')
        stack = [('ground_contact',shadow)]
        for side in ['R','L']:
            boot=boots[side]
            stack += [('trouser_'+side,trousers(side,f,local_foot[side],raster_shift)),('boot_'+side,boot)]
            anchor=contact_anchor(side,f)
            if anchor:
                ax,ay=round(anchor[0]+ox-raster_shift),round(anchor[1]+oy)
                patch = contact_patch(side, f)
                assert patch is not None, ('Missing contact patch', f, side)
                pivot=[58,319] if side=='R' else [104,328]
                angle=local_foot[side]['bootAngle']
                transformed=rotate(patch,pivot,angle)
                px=round(local_foot[side]['ankle'][0]+transformed[0]-pivot[0]+ox)
                py=round(local_foot[side]['ankle'][1]+transformed[1]-pivot[1]+oy)
                alpha=boot.getchannel('A')
                assert alpha.crop((px-1,py-1,px+2,py+2)).getextrema()[1]>200, ('Lost contact patch',f,side,patch,(px,py))
                checks['footChecks'].append({'frame':f,'side':side,'contactPatch':patch,
                                            'actualShoePatchOpaque':True,'patchPixel':[px,py],
                                            'groundAnchor':[ax,ay]})
        stack += upper(f,root-raster_shift)
        stack.append(('pose_paint',art.new_layer()))
        if raster_shift:
            shifted=[]
            for name,layer in stack:
                world=art.new_layer();world.alpha_composite(layer,(raster_shift,0));shifted.append((name,world))
            stack=shifted
        image = art.composite(stack)
        hx=round(root+control('bodyX',f)+control('headLead',f))
        if motion.get('bodyArticulation'):
            hx=raster_shift+round(root-raster_shift+control('bodyX',f)+control('headLead',f))
        hy=round(control('bodyY',f))
        if not motion.get('linkedUpper'):
            head=image.crop((ox+hx,oy+hy,ox+hx+art.original.width,oy+hy+65))
            assert ImageChops.difference(head,art.original.crop((0,0,art.original.width,65))).getbbox(alpha_only=False) is None, ('Head sampling changed',f)
        path = frame_dir/f'{f:03}.png'
        image.save(path)
        if f in motion['editableFrames']:
            art.write_ora(out/f'frame-{f:03}.ora',stack)
        record={'frame':f,'rootX':root,'headRasterShift':None if motion.get('linkedUpper') else [hx,hy],
                'boxAngle':control('boxAngle',f),'feet':foot,'file':'frames/'+path.name}
        if motion.get('linkedUpper'):
            record['upperPose']={**linked_records[f],'rasterShift':raster_shift}
        records.append(record)

    # Native full body, tracked full-body 2x, and real scene-scale playback.
    video_dir = out/'video-frames'
    video_dir.mkdir()
    phase_labels = motion['phaseLabels']
    for record in records:
        f=record['frame']
        actor=Image.open(out/record['file']).convert('RGBA')
        page=Image.new('RGB',(800,800),'#e1e5d7')
        draw=ImageDraw.Draw(page)
        label=next(k['label'] for k in reversed(phase_labels) if f>=k['from'])
        draw.text((24,14),motion.get('title','负重起步 · 左脚落地') if font_path.exists() else 'Loaded steps',font=font,fill='#244238')
        draw.text((24,43),f'{label}  /  {f+1:02} / {last+1}  /  {fps} fps',font=small,fill='#536855')
        page.paste(actor,(0,95),actor)
        x0=round(ox+record['rootX']-12)
        close=actor.crop((x0,oy,x0+180,oy+348)).resize((360,696),Image.Resampling.NEAREST)
        page.paste(close,(420,86),close)
        reduced=actor.resize((round(art.size[0]*.3),120),Image.Resampling.NEAREST)
        page.paste(reduced,(110,550),reduced)
        draw.text((24,510),'完整人物 · 原尺寸' if font_path.exists() else 'Native full figure',font=small,fill='#536855')
        draw.text((24,690),'约 104px 场景尺寸' if font_path.exists() else 'Scene scale',font=small,fill='#536855')
        draw.text((420,65),'跟随全身 · 整数 2 倍' if font_path.exists() else 'Tracked full figure / 2x',font=small,fill='#536855')
        page.save(video_dir/f'{f:03}.png')

    ffmpeg=shutil.which('ffmpeg')
    if not ffmpeg:
        raise RuntimeError('ffmpeg is required to package the motion preview')
    subprocess.run([ffmpeg,'-hide_banner','-loglevel','error','-y','-framerate',str(fps),
                    '-i',str(video_dir/'%03d.png'),'-vf','scale=1600:1600:flags=neighbor',
                    '-c:v','libx264','-crf','14','-pix_fmt','yuv420p',
                    '-movflags','+faststart',str(out/'loaded-step.mp4')],check=True)
    # Contact sheet keeps actual world movement; no pose is resized independently.
    selected=motion['editableFrames']
    sheet=Image.new('RGB',(art.size[0]*len(selected),art.size[1]+40),'#e1e5d7')
    draw=ImageDraw.Draw(sheet)
    for i,f in enumerate(selected):
        actor=Image.open(out/records[f]['file'])
        sheet.paste(actor,(i*art.size[0],35),actor)
        draw.text((i*art.size[0]+12,10),f'frame {f}',font=small,fill='#244238')
    sheet.save(out/'motion-keyposes.png')
    (out/'motion.json').write_text(json.dumps({'fps':fps,'frameCount':last+1,'frameSize':art.size,
        'sourceSha256':art.source_sha256,'frames':records,'artApproved':False,
        'scope':motion.get('scope','One left step, not a loop or multi-direction walk')},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (out/'authoring.json').write_text(json.dumps({'method':__doc__,
        'sourceSha256':art.source_sha256,'recipeSha256':hashlib.sha256(art.recipe_path.read_bytes()).hexdigest(),
        'frameCount':last+1,'fps':fps,'artApproved':False,'productionIntegrated':False,
        'editedClothInput':str(art.cloth_input_path) if art.cloth_input_path else None,
        'editedClothSha256':hashlib.sha256(art.cloth_input_path.read_bytes()).hexdigest() if art.cloth_input_path else None,
        'upperUnderpaintInput':recipe.get('upperUnderpaint'),
        'bodyArticulation':bool(motion.get('bodyArticulation')),
        'linkedUpper':bool(motion.get('linkedUpper')),
        'sleeveOwnershipTransfers':ownership_transfers,
        'upperUnderpaintRgbaSha256':hashlib.sha256(underpaint.tobytes()).hexdigest(),
        'newPaidMediaRequests':0},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (out/'constraint-checks.json').write_text(json.dumps(checks,indent=2)+'\n',encoding='utf-8')
    print(str(out/'loaded-step.mp4'))
