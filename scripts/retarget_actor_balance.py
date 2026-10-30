"""Whole-pose kinematic retargeting, with explicit anatomy and contact targets.

Segment masses only estimate a COM trajectory. This is neither inverse dynamics
nor a proof of physical balance; the unloaded source remains a design reference.
"""
import math
import bpy
import numpy as np
from mathutils import Vector,Matrix


def normalize(v):return v.normalized() if v.length>1e-8 else Vector((0,0,1))
def frame_basis(x,z):
    x=normalize(x);z=normalize(z-x*z.dot(x));y=normalize(z.cross(x));return Matrix((x,y,z)).transposed()
def elbow_flex(s,e,w):
    a=normalize(s-e);b=normalize(w-e)
    return 180-math.degrees(math.acos(max(-1,min(1,a.dot(b)))))


class BalancedTransfer:
    BODY=75.;CASE=3.;RECORDER=.35
    def __init__(self,rig,motion,base,indices):
        self.rig,self.motion,self.base,self.indices=rig,motion,base,indices
        self.base_root=rig.pose.bones['root'].matrix.copy()
        self.base_mats={p.name:p.matrix.copy() for p in rig.pose.bones}
        self.hips0=(rig.pose.bones['upperleg01.R'].head+rig.pose.bones['upperleg01.L'].head)*.5
        length=sum(rig.data.bones[n+'.R'].length for n in ['upperleg01','upperleg02','lowerleg01','lowerleg02'])
        j0=self.points(0);ref_length=(j0['rfemur']-j0['rhipjoint']).length+(j0['rtibia']-j0['rfemur']).length
        self.scale=length/ref_length
        hip0=(j0['rhipjoint']+j0['lhipjoint'])*.5
        self.offset=Vector((-hip0.x*self.scale,-hip0.y*self.scale,.045))
        self.foot_mats={s:self.base_mats['foot.'+s].to_3x3() for s in ['R','L']}
        self.flat_dirs={s:normalize(self.points(25 if s=='R' else 90)[s.lower()+'foot']-self.points(25 if s=='R' else 90)[s.lower()+'tibia']) for s in ['R','L']}
        # Ankle-to-shoe offsets are read from the actual fitted boot mesh.
        boot=bpy.data.objects['Ankle_boots'].evaluated_get(bpy.context.evaluated_depsgraph_get())
        self.boot_offsets={}
        self.boot_object=bpy.data.objects['Ankle_boots']
        self.boot_indices={s:[v.index for v in self.boot_object.data.vertices if (v.co.x<0)==(s=='R')] for s in ['R','L']}
        for side in ['R','L']:
            ankle=rig.pose.bones['foot.'+side].head
            inv=self.foot_mats[side].inverted()
            self.boot_offsets[side]=[inv@(boot.matrix_world@v.co-ankle) for v in boot.data.vertices if (v.co.x<0)==(side=='R')]

    def points(self,i):return {k:Vector((v[0],-v[2],v[1])) for k,v in self.motion[i]['joints'].items()}

    def orient(self,name,rotation):
        pb=self.rig.pose.bones[name];pb.matrix=Matrix.Translation(pb.head)@rotation.to_4x4()
        bpy.context.view_layer.update()

    def direct(self,name,direction):
        pb=self.rig.pose.bones[name]
        current=pb.matrix.to_3x3()@Vector((0,1,0));q=current.rotation_difference(normalize(direction))
        self.orient(name,q.to_matrix()@pb.matrix.to_3x3())

    def chain(self,names,start,end):
        direction=normalize(end-start)
        for name in names:self.direct(name,direction)

    def two_bone(self,upper,lower,target,pole):
        hip=self.rig.pose.bones[upper[0]].head.copy()
        a=sum(self.rig.data.bones[n].length for n in upper);b=sum(self.rig.data.bones[n].length for n in lower)
        delta=target-hip;distance=delta.length;d=max(abs(a-b)+.0001,min(distance,a+b-.0002));axis=normalize(delta)
        pole=normalize(pole-axis*pole.dot(axis));along=(a*a-b*b+d*d)/(2*d);height=math.sqrt(max(0,a*a-along*along))
        knee=hip+axis*along+pole*height
        self.chain(upper,hip,knee);self.chain(lower,knee,target)
        actual=self.rig.pose.bones[lower[-1]].tail
        return {'reachError':(actual-target).length,'clamped':abs(distance-d)>.0003}

    def source_com(self,j):
        total=Vector((0,0,0));hips=(j['rhipjoint']+j['lhipjoint'])*.5
        total+=(hips+j['lowerneck'])*(.497*.5)
        total+=(j['lowerneck']+j['head'])*(.081*.5)
        for s in ['r','l']:
            for a,b,w in [('clavicle','humerus',.028),('humerus','radius',.016),('radius','hand',.006),('hipjoint','femur',.1),('femur','tibia',.0465),('tibia','toes',.0145)]:
                total+=(j[s+a]+j[s+b])*(w*.5)
        return total*self.scale+self.offset

    def estimated_com(self):
        p=self.rig.pose.bones;r=self.rig.matrix_world
        def at(n):return r@p[n].head
        total=Vector((0,0,0));hips=(at('upperleg01.R')+at('upperleg01.L'))*.5
        total+=(hips+at('neck01'))*(.497*.5)
        total+=(at('neck01')+r@p['head'].tail)*(.081*.5)
        for s in ['R','L']:
            for a,b,w in [('upperarm01','lowerarm01',.028),('lowerarm01','wrist',.016),('wrist','finger3-1',.006),('upperleg01','lowerleg01',.1),('lowerleg01','foot',.0465),('foot','toe1-1',.0145)]:
                if b+'.'+s not in p:b='wrist'
                total+=(at(a+'.'+s)+at(b+'.'+s))*(w*.5)
        body=total*self.BODY
        right=r@p['wrist.R'].tail+Vector((0,0,-.165));left=r@p['wrist.L'].tail+Vector((0,-.035,-.04))
        return (body+right*self.CASE+left*self.RECORDER)/(self.BODY+self.CASE+self.RECORDER)

    def legs(self,targets,hinges):
        result={}
        for s in ['R','L']:
            local=self.rig.matrix_world.inverted()@targets[s]
            hip=self.rig.pose.bones['upperleg01.'+s].head
            axis=normalize(local-hip)
            hinge=self.rig.matrix_world.inverted().to_3x3()@hinges[s]
            # A source knee position is not an IK pole. At full extension it
            # is collinear; small hip/ankle corrections can select the backward
            # branch. The signed anatomical hinge survives full extension and
            # is reprojected after EVERY pelvis/foot correction.
            pole=axis.cross(hinge)
            if pole.length<1e-5:raise ValueError('Knee hinge parallel to target leg: '+s)
            result[s]=self.two_bone(['upperleg01.'+s,'upperleg02.'+s],['lowerleg01.'+s,'lowerleg02.'+s],local,pole)
        return result

    def respect_reach(self,targets):
        # Proportion changes can make a recorded ankle unreachable. Adjust the
        # pelvis against both explicit ankle targets, never against whichever
        # arbitrary shoe vertex happens to be lowest in the whole frame.
        excess=0
        for s in ['R','L']:
            hip=self.rig.matrix_world@self.rig.pose.bones['upperleg01.'+s].head
            reach=sum(self.rig.data.bones[n+'.'+s].length for n in ['upperleg01','upperleg02','lowerleg01','lowerleg02'])-.001
            horizontal=math.hypot(hip.x-targets[s].x,hip.y-targets[s].y)
            height=math.sqrt(max(.001,reach*reach-horizontal*horizontal))
            excess=max(excess,hip.z-targets[s].z-height)
        if excess>0:self.rig.location.z-=excess+.0002;bpy.context.view_layer.update()
        return max(0,excess)

    def build(self,i):
        rig=self.rig;j=self.points(i);p=rig.pose.bones
        window=[self.points(n) for n in range(max(0,i-20),min(len(self.motion),i+21))]
        floor=float(np.percentile([min(v['rtibia'].z,v['ltibia'].z) for v in window],10))
        self.offset.z=.098-floor*self.scale
        for bone in p:bone.matrix_basis=self.base[bone.name].copy()
        rig.location=(0,0,0);bpy.context.view_layer.update()
        # Transfer the pelvis's full orientation once, about the anatomical hips.
        pelvis=Matrix(self.motion[i]['pelvisOrientation'])
        pivot=self.hips0
        p['root'].matrix=Matrix.Translation(pivot)@pelvis.to_4x4()@Matrix.Translation(-pivot)@self.base_root
        bpy.context.view_layer.update()
        hip_world=(j['rhipjoint']+j['lhipjoint'])*(.5*self.scale)+self.offset
        hip_local=(p['upperleg01.R'].head+p['upperleg01.L'].head)*.5
        rig.location=hip_world-hip_local;bpy.context.view_layer.update()
        # Absolute orientations avoid successively applying one swing twice to
        # MakeHuman's split upper-arm / forearm bones.
        chest=frame_basis(j['lclavicle']-j['rclavicle'],j['lowerneck']-j['root'])
        for name in ['spine05','spine04','spine03','spine02','spine01']:
            self.orient(name,chest@self.base_mats[name].to_3x3())
        neck=frame_basis(j['lclavicle']-j['rclavicle'],j['head']-j['lowerneck'])
        for name in ['neck01','neck02','neck03','head']:
            self.orient(name,neck@self.base_mats[name].to_3x3())
        # Carrying shoulder drops slightly as a complete clavicle/arm chain.
        name='shoulder01.R';v=p[name].tail-p[name].head;v.z-=.006;self.direct(name,v)
        flex={}
        for s in ['R','L']:
            shoulder=p['upperarm01.'+s].head.copy()
            a=sum(rig.data.bones[n+'.'+s].length for n in ['upperarm01','upperarm02'])
            b=sum(rig.data.bones[n+'.'+s].length for n in ['lowerarm01','lowerarm02'])
            phase=normalize(j[s.lower()+'humerus']-j[s.lower()+'clavicle']).y
            if s=='R':
                bend=15+phase*2
                reach=math.sqrt(a*a+b*b+2*a*b*math.cos(math.radians(bend)))
                direction=normalize(Vector((-.015,.012+phase*.025,-1)))
                target=shoulder+direction*reach
            else:
                # Recorder is held in front of the waist; the forearm is bent,
                # not an independently swinging rod attached to a straight arm.
                target=shoulder+chest@Vector((.012,-.22+phase*.008,-.345))
            pole=chest@Vector((0,1,0))
            self.two_bone(['upperarm01.'+s,'upperarm02.'+s],['lowerarm01.'+s,'lowerarm02.'+s],target,pole)
            self.orient('wrist.'+s,self.base_mats['wrist.'+s].to_3x3())
            flex[s]=elbow_flex(p['upperarm01.'+s].head,p['lowerarm01.'+s].head,p['wrist.'+s].head)
        targets={};hinges={};foot_rots={}
        for s in ['R','L']:
            k=s.lower();q=self.flat_dirs[s].rotation_difference(normalize(j[k+'foot']-j[k+'tibia']))
            rotation=q.to_matrix()@self.foot_mats[s];foot_rots[s]=rotation
            offsets=[rotation@v for v in self.boot_offsets[s]]
            min_z=min(v.z for v in offsets)
            ankle=j[k+'tibia']*self.scale+self.offset
            # Remove only the local capture floor drift. Swing-foot clearance
            # comes from the recorded ankle height, not lowering the whole rig.
            ankle.z=max(-min_z,ankle.z)
            targets[s]=ankle
            hinges[s]=Vector(self.motion[i]['kneeHingeAxes'][k])
        reach_height=self.respect_reach(targets)
        constraints=self.legs(targets,hinges)
        desired=self.source_com(j)
        before=self.estimated_com();total_correction=Vector((0,0,0))
        for _ in range(5):
            current=self.estimated_com();error=desired-current;error.z=0
            if error.length<.001:break
            shift=error*.95
            if shift.length>.018:shift=shift.normalized()*.018
            if (total_correction+shift).length>.075:break
            rig.location+=shift;total_correction+=shift;bpy.context.view_layer.update()
            reach_height+=self.respect_reach(targets)
            constraints=self.legs(targets,hinges)
        for s in ['R','L']:self.orient('foot.'+s,foot_rots[s])
        # Fitted shoes include toe and shin weights. Their evaluated sole can
        # differ from a rigid-foot estimate; correct the explicit support ankle,
        # then solve the complete leg again. Never translate the whole figure
        # merely because a low mesh vertex was found.
        support=min(['R','L'],key=lambda s:j[s.lower()+'tibia'].z)
        sole_baseline=float(np.percentile([min(v['rfoot'].z,v['rtoes'].z,v['lfoot'].z,v['ltoes'].z) for v in window],10))
        contacts=[s for s in ['R','L'] if s==support or min(j[s.lower()+'foot'].z,j[s.lower()+'toes'].z)<=sole_baseline+.25 or j[s.lower()+'tibia'].z<=floor+.25]
        for _ in range(2):
            boot=self.boot_object.evaluated_get(bpy.context.evaluated_depsgraph_get())
            for side in contacts:
                sole=min((boot.matrix_world@boot.data.vertices[n].co).z for n in self.boot_indices[side])
                targets[side].z-=sole
            reach_height+=self.respect_reach(targets)
            constraints=self.legs(targets,hinges)
            for s in ['R','L']:self.orient('foot.'+s,foot_rots[s])
        after=self.estimated_com()
        knees={}
        for s in ['R','L']:
            h=rig.matrix_world@p['upperleg01.'+s].head
            k=rig.matrix_world@p['lowerleg01.'+s].head
            a=rig.matrix_world@p['foot.'+s].head
            upper=normalize(k-h);lower=normalize(a-k)
            knees[s]=math.degrees(math.atan2(hinges[s].dot(upper.cross(lower)),upper.dot(lower)))
            if knees[s]<-.1:raise ValueError('Backward knee rejected: '+s)
        return {'elbowFlexDegrees':flex,'estimatedCom':list(after),'referenceCom':list(desired),
                'kneeFlexionDegrees':knees,'sourceKneeFlexionDegrees':self.motion[i]['kneeFlexionDegrees'],
                'kneeHingeAxes':{s:list(v) for s,v in hinges.items()},
                'comErrorXYBefore':math.hypot(before.x-desired.x,before.y-desired.y),
                'comErrorXYAfter':math.hypot(after.x-desired.x,after.y-desired.y),
                'kinematicBalanceShift':list(total_correction),'legConstraints':constraints,
                'reachHeightCorrection':reach_height,'captureAnkleBaseline':floor,
                'supportFoot':support,'contactFeet':contacts,
                'ankleTargets':{s:list(v) for s,v in targets.items()},
                'assumptionsKg':{'body':self.BODY,'case':self.CASE,'recorder':self.RECORDER},
                'physicalBalanceProven':False}
