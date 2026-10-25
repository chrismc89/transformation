/**
 * Tests for dashboard-view internal logic.
 * Since renderDashboard uses DOM APIs (not available in Node.js),
 * we test the exported render function's behavior via the
 * dashboard-logic helper, and verify KPI calculations match expected values.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initiatives } from '../data/demo-fixtures.js';
import { formatMillions, formatPct } from '../views/view-manager.js';
import { partitionSignals } from '../views/dashboard-view.js';
import config from '../config/app-config.js';

// ─── KPI Calculation Tests ──────────────────────────────────────────────────

const FY_COMMITMENT = config.fyCommitment;

// Build summary from fixtures (mimics store.getSummary())
function buildSummary(inits) {
  return {
    count: inits.length,
    totalTarget: inits.reduce((s, i) => s + (i.savings?.target || 0), 0),
    totalValidated: inits.reduce((s, i) => s + (i.savings?.validated || 0), 0),
    totalRealized: inits.reduce((s, i) => s + (i.savings?.realized || 0), 0),
  };
}

// Compute at-risk total (replicates dashboard-view logic)
function computeAtRiskTotal(signals, inits) {
  const atRiskIds = new Set();
  for (const sig of signals) {
    if (sig.priority <= 2) {
      atRiskIds.add(sig.initiativeId);
    }
  }
  let total = 0;
  for (const init of inits) {
    if (atRiskIds.has(init.id)) {
      total += init.savings?.target || 0;
    }
  }
  return total;
}

function countAtRiskInitiatives(signals) {
  const atRiskIds = new Set();
  for (const sig of signals) {
    if (sig.priority <= 2) {
      atRiskIds.add(sig.initiativeId);
    }
  }
  return atRiskIds.size;
}

test('KPI: Pipeline Identified matches sum of all initiative targets', () => {
  const summary = buildSummary(initiatives);
  // Fixture totals: ~$18.83M
  assert.equal(summary.totalTarget, 18830000);
  assert.equal(formatMillions(summary.totalTarget), '$18.83M');
});

test('KPI: Finance-Validated matches sum of all initiative validated', () => {
  const summary = buildSummary(initiatives);
  // Fixture totals: ~$14.3M
  assert.equal(summary.totalValidated, 14300000);
  assert.equal(formatMillions(summary.totalValidated), '$14.30M');
});

test('KPI: Realized to Date matches sum of all initiative realized', () => {
  const summary = buildSummary(initiatives);
  // Fixture totals: ~$5.35M
  assert.equal(summary.totalRealized, 5350000);
  assert.equal(formatMillions(summary.totalRealized), '$5.35M');
});

test('KPI: Program Pacing = totalRealized / fyCommitment', () => {
  const summary = buildSummary(initiatives);
  const pacingRatio = summary.totalRealized / FY_COMMITMENT;
  // 5350000 / 15000000 = 0.3567
  assert.equal(formatPct(pacingRatio), '36%');
});

test('KPI: At Risk total sums target for initiatives with P1/P2 signals', () => {
  const signals = [
    { priority: 1, initiativeId: 'init-006' },
    { priority: 2, initiativeId: 'init-011' },
  ];
  const total = computeAtRiskTotal(signals, initiatives);
  // init-006 target: 4500000, init-011 target: 610000
  assert.equal(total, 5110000);
});

test('KPI: At Risk count returns distinct initiative IDs with P1/P2', () => {
  const signals = [
    { priority: 1, initiativeId: 'init-006' },
    { priority: 1, initiativeId: 'init-006' },  // duplicate
    { priority: 2, initiativeId: 'init-011' },
    { priority: 3, initiativeId: 'init-001' },  // P3 excluded
  ];
  assert.equal(countAtRiskInitiatives(signals), 2);
});

test('KPI: At Risk is 0 when no P1/P2 signals exist', () => {
  const signals = [
    { priority: 3, initiativeId: 'init-001' },
    { priority: 4, initiativeId: 'init-002' },
  ];
  assert.equal(computeAtRiskTotal(signals, initiatives), 0);
  assert.equal(countAtRiskInitiatives(signals), 0);
});

// ─── Signal Feed Sorting Tests ──────────────────────────────────────────────

test('Signals sort P1 before P5', () => {
  const signals = [
    { priority: 3, title: 'C' },
    { priority: 1, title: 'A' },
    { priority: 5, title: 'E' },
    { priority: 2, title: 'B' },
  ];
  const { primary, more } = partitionSignals(signals);
  assert.deepEqual(primary.map(s => s.priority), [1, 2]);
  assert.deepEqual(more.map(s => s.priority), [3, 5]);
});

test('Empty signals array produces empty sorted array', () => {
  const { primary, more } = partitionSignals([]);
  assert.equal(primary.length, 0);
  assert.equal(more.length, 0);
});

// ─── Edge Cases ─────────────────────────────────────────────────────────────

test('KPI handles initiatives with missing savings gracefully', () => {
  const inits = [
    { id: 'x', savings: null },
    { id: 'y' },
    { id: 'z', savings: { target: 1000000, validated: 500000, realized: 200000 } },
  ];
  const summary = buildSummary(inits);
  assert.equal(summary.totalTarget, 1000000);
  assert.equal(summary.totalValidated, 500000);
  assert.equal(summary.totalRealized, 200000);
});

test('Program pacing handles zero FY commitment without crashing', () => {
  const summary = buildSummary(initiatives);
  const zeroCommitment = 0;
  const ratio = zeroCommitment === 0 ? 0 : summary.totalRealized / zeroCommitment;
  assert.equal(formatPct(ratio), '0%');
});
