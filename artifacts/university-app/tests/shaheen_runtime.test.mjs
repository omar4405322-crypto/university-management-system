import assert from 'node:assert/strict';
import { test } from 'node:test';
import { APPLICATION_STATES, STATE_VISUALS, QUALITY_TIERS, approachVisual } from '../src/components/ai/interactive-orb/shaheenRuntime.js';

test('idle preserves canonical energy and all seven states retain green identity', () => {
  assert.deepEqual(APPLICATION_STATES, ['idle', 'thinking', 'responding', 'success', 'warning', 'error', 'disabled']);
  assert.equal(STATE_VISUALS.idle.energy, 1);
  assert.equal(STATE_VISUALS.idle.orbitSpeed, 1);
  assert.ok(STATE_VISUALS.thinking.energy > 1);
  assert.equal(STATE_VISUALS.thinking.amber, 0);
  assert.ok(STATE_VISUALS.error.energy < 1);
  assert.ok(STATE_VISUALS.error.amber <= .12);
  assert.equal(STATE_VISUALS.disabled.orbitSpeed, 0);
});
test('transitions are continuous, interruptible and frame-rate independent', () => {
  const a = { ...STATE_VISUALS.idle };
  approachVisual(a, STATE_VISUALS.thinking, .1);
  assert.ok(a.energy > 1 && a.energy < STATE_VISUALS.thinking.energy);
  const b = { ...STATE_VISUALS.idle };
  for (let i = 0; i < 10; i++) approachVisual(b, STATE_VISUALS.thinking, .01);
  assert.ok(Math.abs(a.energy - b.energy) < 1e-10);
  approachVisual(a, STATE_VISUALS.error, .1);
  assert.ok(a.energy < b.energy);
});
test('quality tiers bound GPU work without changing core geometry', () => {
  assert.deepEqual(Object.values(QUALITY_TIERS).map(t => t.samples), [3, 4, 6]);
  assert.deepEqual(Object.values(QUALITY_TIERS).map(t => t.dpr), [1, 1.25, 1.75]);
  assert.deepEqual(Object.values(QUALITY_TIERS).map(t => t.particles), [2, 3, 5]);
});
