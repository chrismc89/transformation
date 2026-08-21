/**
 * Unit tests for domains/program-bundle.js — owner-concentration evaluator.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ProgramBundle from '../domains/program-bundle.js';

const { thresholds, evaluators } = ProgramBundle;
const ownerConcentration = evaluators.find(e => e.id === 'owner-concentration');

// Helper to build a minimal context
function buildCtx(initiatives, signals) {
  return { initiatives, signals, asOfDate: '2026-08-15' };
}

test('fires when owner has >= threshold at-risk initiatives', () => {
  const initiatives = [
    { id: 'init-1', owner: 'Alice', savings: { target: 2_000_000 } },
    { id: 'init-2', owner: 'Alice', savings: { target: 3_000_000 } },
  ];
  const signals = [
    { priority: 1, initiativeId: 'init-1', id: 'critical-overdue' },
    { priority: 2, initiativeId: 'init-2', id: 'pipeline-stalled' },
  ];

  const result = ownerConcentration.evaluate(buildCtx(initiatives, signals), thresholds);

  assert.equal(result.length, 1);
  assert.equal(result[0].priority, 4);
  assert.equal(result[0].id, 'owner-concentration');
  assert.equal(result[0].initiativeId, null);
  assert.ok(result[0].title.includes('Alice'));
});

test('does NOT fire when owner is below threshold', () => {
  const initiatives = [
    { id: 'init-1', owner: 'Bob', savings: { target: 1_000_000 } },
    { id: 'init-2', owner: 'Carol', savings: { target: 2_000_000 } },
  ];
  const signals = [
    { priority: 1, initiativeId: 'init-1', id: 'critical-overdue' },
    { priority: 2, initiativeId: 'init-2', id: 'pipeline-stalled' },
  ];

  const result = ownerConcentration.evaluate(buildCtx(initiatives, signals), thresholds);
  assert.equal(result.length, 0);
});

test('produces at most one signal per owner', () => {
  const initiatives = [
    { id: 'init-1', owner: 'Alice', savings: { target: 1_000_000 } },
    { id: 'init-2', owner: 'Alice', savings: { target: 2_000_000 } },
    { id: 'init-3', owner: 'Alice', savings: { target: 3_000_000 } },
  ];
  const signals = [
    { priority: 1, initiativeId: 'init-1', id: 'sig-a' },
    { priority: 2, initiativeId: 'init-2', id: 'sig-b' },
    { priority: 1, initiativeId: 'init-3', id: 'sig-c' },
  ];

  const result = ownerConcentration.evaluate(buildCtx(initiatives, signals), thresholds);

  // Only one signal for Alice, even though 3 initiatives are at-risk
  assert.equal(result.length, 1);
  assert.ok(result[0].title.includes('Alice'));
});

test('returns empty array when no owner meets threshold', () => {
  const initiatives = [
    { id: 'init-1', owner: 'Alice', savings: { target: 1_000_000 } },
    { id: 'init-2', owner: 'Bob', savings: { target: 2_000_000 } },
    { id: 'init-3', owner: 'Carol', savings: { target: 3_000_000 } },
  ];
  const signals = [
    { priority: 1, initiativeId: 'init-1', id: 'sig-a' },
    { priority: 2, initiativeId: 'init-2', id: 'sig-b' },
    { priority: 2, initiativeId: 'init-3', id: 'sig-c' },
  ];

  const result = ownerConcentration.evaluate(buildCtx(initiatives, signals), thresholds);
  assert.equal(result.length, 0);
});

test('consequence text includes count and dollar exposure', () => {
  const initiatives = [
    { id: 'init-1', owner: 'Dan', savings: { target: 4_500_000 } },
    { id: 'init-2', owner: 'Dan', savings: { target: 2_300_000 } },
  ];
  const signals = [
    { priority: 1, initiativeId: 'init-1', id: 'sig-a' },
    { priority: 2, initiativeId: 'init-2', id: 'sig-b' },
  ];

  const result = ownerConcentration.evaluate(buildCtx(initiatives, signals), thresholds);

  assert.equal(result.length, 1);
  // Should mention "2 at-risk initiatives"
  assert.ok(result[0].consequence.includes('2 at-risk initiatives'),
    `Expected consequence to mention count, got: ${result[0].consequence}`);
  // Should mention combined exposure: $6.8M
  assert.ok(result[0].consequence.includes('$6.8M'),
    `Expected consequence to mention $6.8M exposure, got: ${result[0].consequence}`);
});

test('ignores signals with priority > atRiskPriority', () => {
  const initiatives = [
    { id: 'init-1', owner: 'Eve', savings: { target: 1_000_000 } },
    { id: 'init-2', owner: 'Eve', savings: { target: 2_000_000 } },
  ];
  // P3 and P5 signals should not count as at-risk
  const signals = [
    { priority: 3, initiativeId: 'init-1', id: 'sig-a' },
    { priority: 5, initiativeId: 'init-2', id: 'sig-b' },
  ];

  const result = ownerConcentration.evaluate(buildCtx(initiatives, signals), thresholds);
  assert.equal(result.length, 0);
});

test('ignores portfolio signals (initiativeId: null)', () => {
  const initiatives = [
    { id: 'init-1', owner: 'Frank', savings: { target: 1_000_000 } },
    { id: 'init-2', owner: 'Frank', savings: { target: 2_000_000 } },
  ];
  // Portfolio-level signals (initiativeId: null) should be skipped
  const signals = [
    { priority: 1, initiativeId: null, id: 'portfolio-sig-a' },
    { priority: 2, initiativeId: null, id: 'portfolio-sig-b' },
  ];

  const result = ownerConcentration.evaluate(buildCtx(initiatives, signals), thresholds);
  assert.equal(result.length, 0);
});

test('handles multiple owners independently', () => {
  const initiatives = [
    { id: 'init-1', owner: 'Alice', savings: { target: 1_000_000 } },
    { id: 'init-2', owner: 'Alice', savings: { target: 2_000_000 } },
    { id: 'init-3', owner: 'Bob', savings: { target: 3_000_000 } },
    { id: 'init-4', owner: 'Bob', savings: { target: 4_000_000 } },
  ];
  const signals = [
    { priority: 1, initiativeId: 'init-1', id: 'sig-a' },
    { priority: 2, initiativeId: 'init-2', id: 'sig-b' },
    { priority: 1, initiativeId: 'init-3', id: 'sig-c' },
    { priority: 2, initiativeId: 'init-4', id: 'sig-d' },
  ];

  const result = ownerConcentration.evaluate(buildCtx(initiatives, signals), thresholds);

  assert.equal(result.length, 2);
  const owners = result.map(r => r.title);
  assert.ok(owners.some(t => t.includes('Alice')));
  assert.ok(owners.some(t => t.includes('Bob')));
});
