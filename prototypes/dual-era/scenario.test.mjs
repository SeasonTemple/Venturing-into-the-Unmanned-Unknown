import test from 'node:test';
import assert from 'node:assert/strict';
import { createTask, transition, canDeploy, requiredChecks } from './scenario.mjs';
const act = (s, type, extra = {}) => transition(s, { type, ...extra });
const built = (mode) => ['SURVEY', 'BUILD'].reduce((s, type) => act(s, type), createTask(mode));
const approved = (mode) => ['CONFIGURE', 'CHECK', 'FIX', 'CHECK', 'DEPLOY'].reduce((s, type) => act(s, type), built(mode));
test('both executors face identical first candidates and acceptance conditions', () => {
  const a = built('human'), b = built('agent');
  assert.deepEqual(a.candidate, b.candidate); assert.deepEqual(requiredChecks(a), requiredChecks(b));
  assert.equal(canDeploy(a), false); assert.throws(() => act(a, 'DEPLOY'));
});
test('empty or incomplete harness does not turn unchecked work into success', () => {
  let s = act(built('agent'), 'SET_CHECK', { key: 'backup', enabled: true });
  s = act(s, 'CHECK'); assert.equal(s.evidence.backup.pass, true);
  assert.equal(s.evidence.interface, undefined); assert.equal(canDeploy(s), false); assert.throws(() => act(s, 'DEPLOY'));
});
test('the same incompatible connector is detected in both modes', () => {
  for (const mode of ['human', 'agent']) {
    const s = act(act(built(mode), 'CONFIGURE'), 'CHECK');
    assert.equal(s.evidence.interface.pass, false); assert.equal(s.evidence.backup.pass, true); assert.equal(canDeploy(s), false);
  }
});
test('fixing a candidate invalidates all evidence until rechecked', () => {
  const failed = act(built('human'), 'CHECK'), fixed = act(failed, 'FIX');
  assert.deepEqual(fixed.evidence, {}); assert.equal(canDeploy(fixed), false);
  assert.equal(canDeploy(act(fixed, 'CHECK')), true); assert.equal(failed.candidate.connector, 'legacy');
});
test('both executors can restore the network under the same declared conditions', () => {
  const a = approved('human'), b = approved('agent');
  assert.equal(a.accepted, true); assert.equal(b.accepted, true); assert.deepEqual(a.candidate, b.candidate);
});
test('new environment conditions invalidate acceptance in both modes', () => {
  for (const mode of ['human', 'agent']) {
    let s = act(approved(mode), 'ENV_CHANGE');
    assert.equal(s.accepted, false); assert.equal(requiredChecks(s).includes('interference'), true);
    assert.throws(() => act(s, 'DEPLOY'));
    s = act(act(s, 'ADAPT'), 'CHECK'); assert.equal(canDeploy(s), true);
    assert.equal(act(s, 'DEPLOY').disturbed, true);
  }
});
test('recorded events replay to the same facts and evidence', () => {
  const original = act(approved('agent'), 'ENV_CHANGE');
  const replay = original.history.reduce((s, item) => transition(s, item.event), createTask('agent'));
  assert.deepEqual(original, replay);
});
