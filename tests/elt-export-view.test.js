/**
 * Tests for elt-export-view internal logic.
 * Since renderELTExport uses DOM APIs (not available in Node.js),
 * we test the narrative generation and data helper logic directly.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initiatives } from '../data/demo-fixtures.js';
import { formatMillions, formatPct } from '../views/view-manager.js';
import config from '../config/app-config.js';

// ─── Replicate internal logic for testing ───────────────────────────────────

function buildSummary(inits) {
  return {
    count: inits.length,
    totalTarget: inits.reduce((s, i) => s + (i.savings?.target || 0), 0),
    totalValidated: inits.reduce((s, i) => s + (i.savings?.validated || 0), 0),
    totalRealized: inits.reduce((s, i) => s + (i.savings?.realized || 0), 0),
    workstreams: [...new Set(inits.map(i => i.workstream))].length,
  };
}

function getP1Initiatives(signals, inits) {
  const p1Ids = new Set();
  for (const sig of signals) {
    if (sig.priority === 1) {
      p1Ids.add(sig.initiativeId);
    }
  }
  return inits.filter(init => p1Ids.has(init.id));
}

function countP1P2Signals(signals) {
  return signals.filter(sig => sig.priority <= 2).length;
}

function buildNarrative(summary) {
  const identified = formatMillions(summary.totalTarget);
  const validatedPct = formatPct(summary.totalTarget ? summary.totalValidated / summary.totalTarget : 0);
  const realized = formatMillions(summary.totalRealized);
  const fyCommitment = formatMillions(config.fyCommitment);

  return `Procurement transformation pipeline stands at <strong style="color:#fff">${identified}</strong> identified, <strong style="color:#fff">${validatedPct} validated</strong> by Finance, and <strong style="color:#fff">${realized} realized</strong> against a ${fyCommitment} FY run-rate commitment.`;
}

function buildAttentionNarrative(p1Initiatives) {
  const count = p1Initiatives.length;
  const countWord = count === 1 ? 'One initiative requires' : `${count} initiatives require`;
  const names = p1Initiatives.map(init => `<strong style="color:#fff">${init.name}</strong>`);
  const nameList = names.length <= 2
    ? names.join(' and ')
    : names.slice(0, -1).join(', ') + ', and ' + names[names.length - 1];
  return `${countWord} ELT attention this cycle: ${nameList}.`;
}

// ─── Narrative Generation Tests ─────────────────────────────────────────────

test('Narrative includes total identified pipeline amount', () => {
  const summary = buildSummary(initiatives);
  const narrative = buildNarrative(summary);
  assert.ok(narrative.includes('$18.83M'));
});

test('Narrative includes validated percentage', () => {
  const summary = buildSummary(initiatives);
  const narrative = buildNarrative(summary);
  assert.ok(narrative.includes('76% validated'));
});

test('Narrative includes realized amount', () => {
  const summary = buildSummary(initiatives);
  const narrative = buildNarrative(summary);
  assert.ok(narrative.includes('$5.35M realized'));
});

test('Narrative includes FY commitment figure', () => {
  const summary = buildSummary(initiatives);
  const narrative = buildNarrative(summary);
  assert.ok(narrative.includes('$15.00M'));
});

test('Narrative handles zero totalTarget without NaN', () => {
  const summary = { totalTarget: 0, totalValidated: 0, totalRealized: 0 };
  const narrative = buildNarrative(summary);
  assert.ok(narrative.includes('$0.00M'));
  assert.ok(narrative.includes('0% validated'));
  assert.ok(!narrative.includes('NaN'));
});

// ─── P1 Initiative Highlight Tests ──────────────────────────────────────────

test('getP1Initiatives returns only initiatives with P1 signals', () => {
  const signals = [
    { priority: 1, initiativeId: 'init-006' },
    { priority: 2, initiativeId: 'init-011' },
    { priority: 1, initiativeId: 'init-011' },
  ];
  const p1 = getP1Initiatives(signals, initiatives);
  const ids = p1.map(i => i.id);
  assert.ok(ids.includes('init-006'));
  assert.ok(ids.includes('init-011'));
  assert.equal(p1.length, 2);
});

test('getP1Initiatives returns empty array when no P1 signals', () => {
  const signals = [
    { priority: 2, initiativeId: 'init-006' },
    { priority: 3, initiativeId: 'init-001' },
  ];
  const p1 = getP1Initiatives(signals, initiatives);
  assert.equal(p1.length, 0);
});

test('Attention narrative lists single initiative correctly', () => {
  const p1 = [{ name: 'DC Network Consolidation' }];
  const narrative = buildAttentionNarrative(p1);
  assert.ok(narrative.includes('One initiative requires'));
  assert.ok(narrative.includes('DC Network Consolidation'));
});

test('Attention narrative lists two initiatives with "and"', () => {
  const p1 = [
    { name: 'DC Network Consolidation' },
    { name: 'Facilities Services Rebid' },
  ];
  const narrative = buildAttentionNarrative(p1);
  assert.ok(narrative.includes('2 initiatives require'));
  assert.ok(narrative.includes('DC Network Consolidation'));
  assert.ok(narrative.includes(' and '));
  assert.ok(narrative.includes('Facilities Services Rebid'));
});

test('Attention narrative lists three initiatives with Oxford comma', () => {
  const p1 = [
    { name: 'Initiative A' },
    { name: 'Initiative B' },
    { name: 'Initiative C' },
  ];
  const narrative = buildAttentionNarrative(p1);
  assert.ok(narrative.includes('3 initiatives require'));
  // Oxford comma: "A, B, and C" pattern (names wrapped in <strong> tags)
  assert.ok(narrative.includes(', and <strong'));
  assert.ok(narrative.includes('Initiative C'));
});

// ─── Statistics Row Tests ───────────────────────────────────────────────────

test('countP1P2Signals counts only P1 and P2', () => {
  const signals = [
    { priority: 1 },
    { priority: 2 },
    { priority: 2 },
    { priority: 3 },
    { priority: 4 },
  ];
  assert.equal(countP1P2Signals(signals), 3);
});

test('countP1P2Signals returns 0 for empty signals', () => {
  assert.equal(countP1P2Signals([]), 0);
});

test('Summary workstream count is 7 for demo fixtures', () => {
  const summary = buildSummary(initiatives);
  assert.equal(summary.workstreams, 7);
});

test('Summary initiative count is 13 for demo fixtures', () => {
  const summary = buildSummary(initiatives);
  assert.equal(summary.count, 13);
});
