"""Measure saved evaluated geometry against original capture, not solver flags."""
import argparse
import json
import math
from pathlib import Path
import bpy
from mathutils import Vector, Matrix
from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--source-dir', type=Path, required=True)
args = parser.parse_args()
folder = args.source_dir.resolve()
doc = json.loads((folder/'reference.json').read_text())
motion = json.loads((ROOT/'.lab/whole-walk/cmu-sampled/world-joints.json').read_text())['frames']
bpy.ops.wm.open_mainfile(filepath=str(folder/'motion-reference.blend'))
scene = bpy.context.scene
rig = bpy.data.objects['Fieldworker_master_rig']
rotation = Matrix(doc['studioCalibration']['matrix']).to_3x3()
errors = {'kneeDegrees': 0., 'elbowDegrees': 0., 'publishedJointM': 0., 'publishedSoleM': 0.}
hand_checks = {'maxWristDeviationDegrees': 0., 'maxPalmFrameStepDegrees': 0., 'minMiddleFingerPalmarCurlM': 1.}
previous_hand_frames = {}
min_knee, max_length_error = 180., 0.
boot = bpy.data.objects['Ankle_boots']
ids = {s: [v.index for v in boot.data.vertices if (v.co.x < 0) == (s == 'R')] for s in ['R', 'L']}
baseline_lengths = {}


def angle(h, k, a, axis):
    u, v = (k-h).normalized(), (a-k).normalized()
    return math.degrees(math.atan2(axis.normalized().dot(u.cross(v)), u.dot(v)))


for f, record in enumerate(doc['frames'], 1):
    scene.frame_set(f)
    original = motion[record['sourceFrame']-1]
    positions = {n: rig.matrix_world@p.head for n, p in rig.pose.bones.items()}
    for name, published in record['joints'].items():
        errors['publishedJointM'] = max(errors['publishedJointM'], (positions[name]-Vector(published)).length)
    for side in ['R', 'L']:
        for kind, names, axis_key, channel_key, error_key in [
            ('leg', ['upperleg01', 'lowerleg01', 'foot'], 'kneeHingeAxes', 'kneeFlexionDegrees', 'kneeDegrees'),
            ('arm', ['upperarm01', 'lowerarm01', 'wrist'], 'elbowHingeAxes', 'elbowFlexionDegrees', 'elbowDegrees')]:
            h, k, a = [positions[n+'.'+side] for n in names]
            axis = rotation@Vector(original[axis_key][side.lower()])
            value = angle(h, k, a, axis)
            errors[error_key] = max(errors[error_key], abs(value-original[channel_key][side.lower()]))
            if kind == 'leg':
                min_knee = min(min_knee, value)
            lengths = ((k-h).length, (a-k).length)
            key = kind+side
            if key not in baseline_lengths:
                baseline_lengths[key] = lengths
            max_length_error = max(max_length_error, *(abs(a-b) for a, b in zip(lengths, baseline_lengths[key])))
        wrist = positions['wrist.'+side]
        elbow = positions['lowerarm01.'+side]
        middle = positions['finger3-1.'+side]
        palm_direction = (middle-wrist).normalized()
        radial = positions['finger2-1.'+side]-positions['finger5-1.'+side]
        thumb_side = (radial-palm_direction*radial.dot(palm_direction)).normalized()
        normal = thumb_side.cross(palm_direction).normalized()
        hand_frame = Matrix((thumb_side, palm_direction, normal)).transposed().to_quaternion()
        deviation = math.degrees((wrist-elbow).normalized().angle(palm_direction))
        hand_checks['maxWristDeviationDegrees'] = max(hand_checks['maxWristDeviationDegrees'], deviation)
        if side in previous_hand_frames:
            change = math.degrees(hand_frame.rotation_difference(previous_hand_frames[side]).angle)
            change = min(change, 360-change)
            hand_checks['maxPalmFrameStepDegrees'] = max(hand_checks['maxPalmFrameStepDegrees'], change)
        previous_hand_frames[side] = hand_frame
        tip = rig.matrix_world@rig.pose.bones['finger3-3.'+side].tail
        palmar = normal*(1 if side == 'R' else -1)
        hand_checks['minMiddleFingerPalmarCurlM'] = min(hand_checks['minMiddleFingerPalmarCurlM'], (tip-middle).dot(palmar))
    evaluated = boot.evaluated_get(bpy.context.evaluated_depsgraph_get())
    for side, indices in ids.items():
        sole = min((evaluated.matrix_world@evaluated.data.vertices[n].co).z for n in indices)
        errors['publishedSoleM'] = max(errors['publishedSoleM'], abs(sole-record['soleClearanceFromFixedFloor'][side]))

roundtrip = {}
for f in [1, 13, 31]:
    scene.frame_set(f)
    scene.render.filepath = str(folder/f'reopen-{f:02}.png')
    bpy.ops.render.render(write_still=True)
    actual = Image.open(scene.render.filepath).convert('RGBA')
    previous = Image.open(folder/'frames'/f'clay-{f-1:03}.png').convert('RGBA')
    roundtrip[str(f)] = ImageChops.difference(actual, previous).getbbox() is None

checks = {'frames': len(doc['frames']), 'maxErrors': errors, 'minSignedKneeDegrees': min_knee,
          'maxLimbSpanLengthVariationM': max_length_error, 'rerenderIdentical': roundtrip,
          'oneStaticCalibration': True, 'perFrameFootIK': False, 'massTrajectoryFitting': False,
          'fixedFloorResidualRangeMm': doc['lowestSoleClearanceRangeMm'],
          'handMode': doc.get('handMode', 'source'), 'evaluatedHands': hand_checks,
          'artApproved': False, 'naturalLoadedGaitApproved': False}
(folder/'evaluation-checks.json').write_text(json.dumps(checks, indent=2)+'\n', encoding='utf8')
print(json.dumps(checks))
assert max(errors['kneeDegrees'], errors['elbowDegrees']) < .01
assert min_knee > -.1
assert max_length_error < .0001
assert max(errors['publishedJointM'], errors['publishedSoleM']) < .0001
assert all(roundtrip.values())
if doc.get('handMode') == 'relaxed':
    assert hand_checks['maxWristDeviationDegrees'] < 3, 'Neutral hand bends away from actual forearm'
    assert hand_checks['maxPalmFrameStepDegrees'] < 35, 'Palm frame jumps between adjacent samples'
    assert hand_checks['minMiddleFingerPalmarCurlM'] > .015, 'Finger curls backward or remains fully splayed'
