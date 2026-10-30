"""Audit anatomical knee direction independently of target IK residuals.

Checks sampled source hinges against the original AMC flexion channels, then
measures exported hip/knee/ankle positions. Passing does not certify gait.
"""
import argparse
import json
from pathlib import Path
import numpy as np

parser = argparse.ArgumentParser()
parser.add_argument('--candidate', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
source = json.loads((root / '.lab/whole-walk/cmu-sampled/world-joints.json').read_text())['frames']


def signed_flex(hip, knee, ankle, hinge):
    upper, lower = np.asarray(knee)-hip, np.asarray(ankle)-knee
    upper /= np.linalg.norm(upper)
    lower /= np.linalg.norm(lower)
    return float(np.degrees(np.arctan2(np.dot(hinge, np.cross(upper, lower)), np.dot(upper, lower))))


source_errors = []
for frame in source:
    for side in ['r', 'l']:
        points = [np.asarray(frame['joints'][side+n])[[0, 2, 1]] * [1, -1, 1] for n in ['hipjoint', 'femur', 'tibia']]
        angle = signed_flex(*points, frame['kneeHingeAxes'][side])
        source_errors.append(abs(angle-frame['kneeFlexionDegrees'][side]))


def audit(path):
    doc = json.loads(path.read_text())
    rows = []
    for frame in doc['frames']:
        original = source[frame['sourceFrame']-1]
        for side in ['R', 'L']:
            points = [np.asarray(frame['joints'][n+'.'+side]) for n in ['upperleg01', 'lowerleg01', 'foot']]
            angle = signed_flex(*points, original['kneeHingeAxes'][side.lower()])
            reference = original['kneeFlexionDegrees'][side.lower()]
            rows.append({'frame': frame['frame']+1, 'side': side,
                         'sourceFlexDegrees': reference, 'targetSignedFlexDegrees': angle,
                         'sourceDeviationDegrees': angle-reference})
    return {'reference': str(path), 'measurements': rows,
            'backwardKnees': [r for r in rows if r['targetSignedFlexDegrees'] < -1],
            'maxSourceDeviationDegrees': max(abs(r['sourceDeviationDegrees']) for r in rows),
            'naturalMotionApproved': False}


previous = audit(root / 'prototypes/visual-direction/actor-balance-reference-v01/reference.json')
candidate = audit(args.candidate)
report = {'sourceHingeChannelMaxErrorDegrees': max(source_errors),
          'previous': previous, 'axisCorrectionExperiment': candidate,
          'conclusion': 'Reject balance01. Removing backward knees alone does not restore the source gait; contact and pelvis corrections still alter knee flexion.',
          'artApproved': False, 'productionIntegrated': False}
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf8')
print(json.dumps({'sourceAxisErrorDegrees': max(source_errors),
                  'previousBackwardKnees': len(previous['backwardKnees']),
                  'candidateBackwardKnees': len(candidate['backwardKnees']),
                  'candidateMaxSourceDeviationDegrees': candidate['maxSourceDeviationDegrees']}))
assert max(source_errors) < .001, 'Sampler hinge does not match original flexion channel'
assert previous['backwardKnees'], 'Known rejected fixture did not reproduce backward knee'
assert not candidate['backwardKnees'], 'Candidate still contains backward knees'
