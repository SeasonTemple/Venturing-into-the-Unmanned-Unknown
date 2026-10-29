"""Reopen a fieldwear candidate; verify saved structure, not artistic quality."""
import argparse
import hashlib
import json
from pathlib import Path

import bpy

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--out-dir', required=True, type=Path)
out = parser.parse_args().out_dir.resolve()
root = Path(__file__).resolve().parents[1]
study = json.loads((out / 'study.json').read_text(encoding='utf-8'))
parent = root / study['parentStudy'] / 'representation-study.blend'
bpy.context.preferences.filepaths.use_scripts_auto_execute = False


def snapshot(path):
    bpy.ops.wm.open_mainfile(filepath=str(path))
    bpy.context.scene.frame_set(1)
    bpy.context.view_layer.update()
    rig = bpy.data.objects['Fieldworker_master_rig']
    feet = {s: list(rig.matrix_world @ rig.pose.bones['foot.' + s].head)
            for s in ['L', 'R']}
    grips = {}
    for name, side in [('Toolbox_handle_in_right_palm', 'R'),
                       ('Recorder_grip_bar', 'L')]:
        wrist = rig.matrix_world @ rig.pose.bones['wrist.' + side].matrix
        relative = wrist.inverted() @ bpy.data.objects[name].matrix_world
        grips[name] = [list(row) for row in relative]
    return feet, grips


before_feet, before_grips = snapshot(parent)
after_feet, after_grips = snapshot(out / 'representation-study.blend')
rig = bpy.data.objects['Fieldworker_master_rig']
names = ['Field_Jacket_Open_Standing_Collar', 'Field_Backpack_Canvas_Body',
         'Field_Backpack_Folded_Flap', 'Field_Backpack_Shoulder_Strap.L',
         'Field_Backpack_Shoulder_Strap.R', 'Field_Workboot_Shaft.L',
         'Field_Workboot_Shaft.R']
rigged = {}
for name in names:
    ob = bpy.data.objects[name]
    rigged[name] = (ob.parent == rig and
                   any(m.type == 'ARMATURE' and m.object == rig for m in ob.modifiers)
                   and all(sum(g.weight for g in v.groups) > .99 for v in ob.data.vertices))
pack = bpy.data.objects['Field_Backpack_Canvas_Body']
spine = pack.vertex_groups['spine02'].index
pack_on_spine = all(any(g.group == spine and g.weight > .999 for g in v.groups)
                    for v in pack.data.vertices)
foot_delta = max(abs(after_feet[s][i] - before_feet[s][i])
                 for s in before_feet for i in range(3))
grip_delta = max(abs(after_grips[n][i][j] - before_grips[n][i][j])
                 for n in before_grips for i in range(4) for j in range(4))
center_delta = max(abs(after_grips[n][i][3] - before_grips[n][i][3])
                   for n in before_grips for i in range(3))
bar_axis_delta = max(abs(after_grips[n][i][1] - before_grips[n][i][1])
                     for n in before_grips for i in range(3))
right_delta = max(abs(after_grips['Toolbox_handle_in_right_palm'][i][j] -
                      before_grips['Toolbox_handle_in_right_palm'][i][j])
                  for i in range(4) for j in range(4))
grip_mode = study.get('gripValidation', 'full-matrix')
assert grip_mode in ['full-matrix', 'center-and-bar-axis']
checks = {
    'freshProcessReopen': True,
    'parentBlendUnchanged': hashlib.sha256(parent.read_bytes()).hexdigest() == study['parentBlendSha256'],
    'fileImagesPacked': all(im.packed_file is not None for im in bpy.data.images if im.source == 'FILE'),
    'newSurfacesRiggedAndWeighted': rigged,
    'backpackWeightedToSpine': pack_on_spine,
    'feetWorldDeltaMeters': foot_delta,
    'gripWristRelativeMatrixMaxDelta': grip_delta,
    'gripValidationMode': grip_mode,
    'gripCenterWristLocalMaxDelta': center_delta,
    'gripBarAxisWristLocalMaxDelta': bar_axis_delta,
    'rightGripMatrixMaxDelta': right_delta,
    'artApproved': False,
    'scope': 'Saved source structure and attachments only. Motion export status is recorded separately in the gesture study.'
}
(out / 'source-checks.json').write_text(json.dumps(checks, indent=2) + '\n', encoding='utf-8')
assert checks['parentBlendUnchanged'] and checks['fileImagesPacked']
assert all(rigged.values()) and pack_on_spine
assert foot_delta < 1e-5
if grip_mode == 'full-matrix':
    assert grip_delta < 1e-5
else:
    # Explicit source redesign may rotate the hand about a round grip bar.
    # Its center/axis must stay in the same palm spot; right grip stays rigid.
    assert center_delta < 1e-5 and bar_axis_delta < 1e-5 and right_delta < 1e-5
print(json.dumps(checks, indent=2))
