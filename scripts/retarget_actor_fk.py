"""Calibrated FK reference. No foot IK, mass fitting or occupied-arm edits.

Each limb is transferred as anatomical frames. A rigid transform is shared by
the target's split deformation bones; their rest offsets are retained. Source
hinge axes determine twist even at full extension. This does not certify art.
"""
import math
import bpy
from mathutils import Matrix, Vector, Quaternion


def unit(value):
    if value.length < 1e-7:
        raise ValueError('Degenerate calibration vector')
    return value.normalized()


def frame(direction, hinge):
    y = unit(direction)
    x = unit(hinge-y*hinge.dot(y))
    z = unit(x.cross(y))
    return Matrix((x, y, z)).transposed()


def signed_angle(upper, lower, hinge):
    u, v = unit(upper), unit(lower)
    return math.degrees(math.atan2(unit(hinge).dot(u.cross(v)), u.dot(v)))


class CalibratedFK:
    def __init__(self, rig, motion, hand_mode='source', foot_mode='source'):
        self.rig, self.motion = rig, motion
        self.hand_mode = hand_mode
        self.foot_mode = foot_mode
        self.rest = {b.name: b.matrix_local.copy() for b in rig.data.bones}
        self.span_frames = {}
        self.hand_frames = {}
        self.relaxed_hand_frames = {}
        self.finger_relaxation = {}
        for side in ['R', 'L']:
            for limb, upper, lower, end in [('leg', 'upperleg01', 'lowerleg01', 'foot'), ('arm', 'upperarm01', 'lowerarm01', 'wrist')]:
                hip, knee, ankle = [rig.data.bones[n+'.'+side].head_local for n in [upper, lower, end]]
                a, b = knee-hip, ankle-knee
                # Legs' rest flexion is close to zero. Define their anatomical
                # axis from the common body axes, not from an unstable cross.
                hinge = Vector((1, 0, 0)) if limb == 'leg' else unit(a.cross(b))
                self.span_frames[(side, limb, 'upper')] = frame(a, hinge)
                self.span_frames[(side, limb, 'lower')] = frame(b, hinge)
            wrist = rig.data.bones['wrist.'+side]
            thumb = rig.data.bones['finger1-1.'+side]
            self.hand_frames[side] = frame(wrist.tail_local-wrist.head_local, thumb.head_local-wrist.head_local)
            middle = rig.data.bones['finger3-1.'+side].head_local
            radial = rig.data.bones['finger2-1.'+side].head_local-rig.data.bones['finger5-1.'+side].head_local
            longitudinal = middle-wrist.head_local
            self.relaxed_hand_frames[side] = frame(longitudinal, radial)
            # The same thumb/longitudinal frame has opposite palmar signs in
            # mirrored hands. Curl toward the physical palm on each side.
            palmar = unit(radial.cross(longitudinal))*(1 if side == 'R' else -1)
            for digit in range(1, 6):
                for segment, degrees in enumerate([20, 25, 15] if digit > 1 else [12, 12, 5], 1):
                    name = f'finger{digit}-{segment}.{side}'
                    bone = rig.data.bones[name]
                    direction = unit(bone.tail_local-bone.head_local)
                    toward = palmar if digit > 1 else unit(rig.data.bones['finger2-1.'+side].head_local-bone.head_local)
                    axis = unit(direction.cross(toward))
                    local_axis = bone.matrix_local.to_3x3().inverted()@axis
                    self.finger_relaxation[name] = Quaternion(local_axis, math.radians(degrees))
        self.hips = (rig.data.bones['upperleg01.R'].head_local+rig.data.bones['upperleg01.L'].head_local)*.5
        source = self.points(0)
        lengths, source_lengths = [], []
        for side in ['R', 'L']:
            h, k, a = [rig.data.bones[n+'.'+side].head_local for n in ['upperleg01', 'lowerleg01', 'foot']]
            lengths.append((k-h).length+(a-k).length)
            h, k, a = [source[side.lower()+n] for n in ['hipjoint', 'femur', 'tibia']]
            source_lengths.append((k-h).length+(a-k).length)
        self.scale = sum(lengths)/sum(source_lengths)
        self.source_hip0 = (source['rhipjoint']+source['lhipjoint'])*.5
        self.offset = self.hips-self.source_hip0*self.scale
        self.source_foot_rest = {
            side: Matrix(motion[0]['boneOrientations'][side.lower()+'foot'])
            for side in ['R', 'L']
        }
        self.source_toe_rest = {
            side: Matrix(motion[0]['boneOrientations'][side.lower()+'toes'])
            for side in ['R', 'L']
        }

    def points(self, i):
        return {n: Vector((v[0], -v[2], v[1])) for n, v in self.motion[i]['joints'].items()}

    def set_rotation(self, name, world_delta):
        pb = self.rig.pose.bones[name]
        # Keep inherited joint position. Rotate the complete rest segment,
        # instead of independently aiming each split bone at the same point.
        pb.matrix = Matrix.Translation(pb.head) @ (world_delta @ self.rest[name].to_3x3()).to_4x4()
        bpy.context.view_layer.update()

    def span(self, side, kind, part, names, direction, hinge):
        delta = frame(direction, hinge) @ self.span_frames[(side, kind, part)].transposed()
        for name in names:
            self.set_rotation(name+'.'+side, delta)

    def build(self, i):
        rig = self.rig
        for pb in rig.pose.bones:
            pb.matrix_basis.identity()
        rig.location = (0, 0, 0)
        bpy.context.view_layer.update()
        record = self.motion[i]
        j = self.points(i)
        orient = {n: Matrix(v) for n, v in record['boneOrientations'].items()}
        rig.pose.bones['root'].matrix = orient['root'].to_4x4() @ self.rest['root']
        bpy.context.view_layer.update()
        desired = (j['rhipjoint']+j['lhipjoint'])*(.5*self.scale)+self.offset
        actual = (rig.pose.bones['upperleg01.R'].head+rig.pose.bones['upperleg01.L'].head)*.5
        rig.location = desired-actual
        bpy.context.view_layer.update()
        for source, names in [('lowerback', ['spine05', 'spine04']), ('upperback', ['spine03', 'spine02']), ('thorax', ['spine01']), ('lowerneck', ['neck01']), ('upperneck', ['neck02', 'neck03']), ('head', ['head'])]:
            for name in names:
                self.set_rotation(name, orient[source])
        for side in ['R', 'L']:
            s = side.lower()
            for name in ['clavicle', 'shoulder01']:
                self.set_rotation(name+'.'+side, orient[s+'clavicle'])
            hinge = Vector(record['kneeHingeAxes'][s])
            self.span(side, 'leg', 'upper', ['upperleg01', 'upperleg02'], j[s+'femur']-j[s+'hipjoint'], hinge)
            self.span(side, 'leg', 'lower', ['lowerleg01', 'lowerleg02'], j[s+'tibia']-j[s+'femur'], hinge)
            if self.foot_mode == 'relative':
                # The source and target foot bones have different rest frames.
                # Transfer motion relative to the source rest, then apply it to
                # the target rest frame. The old source mode intentionally
                # remains available for comparison.
                foot_delta = orient[s+'foot'] @ self.source_foot_rest[side].transposed()
                toe_delta = orient[s+'toes'] @ self.source_toe_rest[side].transposed()
            else:
                foot_delta = orient[s+'foot']
                toe_delta = orient[s+'toes']
            self.set_rotation('foot.'+side, foot_delta)
            for pb in rig.pose.bones:
                if pb.name.startswith('toe') and pb.name.endswith('.'+side):
                    self.set_rotation(pb.name, toe_delta)
            hinge = Vector(record['elbowHingeAxes'][s])
            self.span(side, 'arm', 'upper', ['upperarm01', 'upperarm02'], j[s+'humerus']-j[s+'clavicle'], hinge)
            # CMU's radius and wrist segments together span the forearm.
            self.span(side, 'arm', 'lower', ['lowerarm01', 'lowerarm02'], j[s+'wrist']-j[s+'humerus'], hinge)
            # Calibrate the palm as well: copying the raw source rotation onto
            # a different rest wrist leaves a sideways, splayed-looking hand.
            if self.hand_mode == 'source':
                hand_frame = frame(j[s+'hand']-j[s+'wrist'], j[s+'thumb']-j[s+'wrist'])
                self.set_rotation('wrist.'+side, hand_frame @ self.hand_frames[side].transposed())
            else:
                # Source thumb/hand helper points do not provide a validated
                # palm pose for this asset. Author a relaxed neutral wrist;
                # retain captured forearm pronation, rather than locking the
                # hand in world space or copying a biased helper-point bend.
                direction = unit(j[s+'wrist']-j[s+'humerus'])
                guide = unit(hinge.cross(direction))
                twist = orient[s+'wrist']@orient[s+'radius'].transposed()
                thumb_side = twist@guide
                lower_delta = frame(direction, hinge)@self.span_frames[(side, 'arm', 'lower')].transposed()
                identity = Quaternion((1, 0, 0, 0))
                for name, fraction in [('lowerarm01', .3), ('lowerarm02', .7)]:
                    partial = identity.slerp(twist.to_quaternion(), fraction).to_matrix()
                    self.set_rotation(name+'.'+side, partial@lower_delta)
                hand_frame = frame(direction, thumb_side)
                self.set_rotation('wrist.'+side, hand_frame@self.relaxed_hand_frames[side].transposed())
                for name, q in self.finger_relaxation.items():
                    if name.endswith('.'+side):
                        rig.pose.bones[name].rotation_quaternion = q
                bpy.context.view_layer.update()
        positions = {pb.name: list(rig.matrix_world @ pb.head) for pb in rig.pose.bones}
        measured = {}
        for side in ['R', 'L']:
            hip, knee, ankle = [Vector(positions[n+'.'+side]) for n in ['upperleg01', 'lowerleg01', 'foot']]
            elbow, wrist = [Vector(positions[n+'.'+side]) for n in ['lowerarm01', 'wrist']]
            shoulder = Vector(positions['upperarm01.'+side])
            measured[side] = {
                'sourceKnee': record['kneeFlexionDegrees'][side.lower()],
                'targetKnee': signed_angle(knee-hip, ankle-knee, Vector(record['kneeHingeAxes'][side.lower()])),
                'sourceElbow': record['elbowFlexionDegrees'][side.lower()],
                'targetElbow': signed_angle(elbow-shoulder, wrist-elbow, Vector(record['elbowHingeAxes'][side.lower()])),
            }
        hands = {}
        for side in ['R', 'L']:
            wrist = Vector(positions['wrist.'+side])
            middle = Vector(positions['finger3-1.'+side])
            elbow = Vector(positions['lowerarm01.'+side])
            radial = Vector(positions['finger2-1.'+side])-Vector(positions['finger5-1.'+side])
            palm = unit(middle-wrist)
            hands[side] = {'palmDirection': list(palm), 'thumbSide': list(unit(radial-palm*radial.dot(palm))),
                           'wristDeviationDegrees': math.degrees(unit(wrist-elbow).angle(palm)),
                           'fingerTip': list(rig.matrix_world@rig.pose.bones['finger3-3.'+side].tail)}
        return {'joints': positions, 'angles': measured, 'hands': hands, 'handMode': self.hand_mode,
                'footMode': self.foot_mode,
                'sourceJoints': {n: list(v*self.scale+self.offset) for n, v in j.items()},
                'rootPosition': list(rig.location), 'sourceFrame': record['frame'],
                'sourceKneeAxes': record['kneeHingeAxes'], 'sourceElbowAxes': record['elbowHingeAxes']}
