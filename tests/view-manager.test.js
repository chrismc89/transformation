/**
 * Tests for view-manager shared utility functions.
 * Verifies formatMillions, formatPct, and ragClass behavior.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatMillions, formatPct, ragClass, deriveInitiativeRag, RAG_LABEL } from '../views/view-manager.js';

// ─── formatMillions ─────────────────────────────────────────────────────────

test('formatMillions: 3200000 → "$3.20M"', () => {
  assert.equal(formatMillions(3200000), '$3.20M');
});

test('formatMillions: 18830000 → "$18.83M"', () => {
  assert.equal(formatMillions(18830000), '$18.83M');
});

test('formatMillions: 0 → "$0.00M"', () => {
  assert.equal(formatMillions(0), '$0.00M');
});

test('formatMillions: 500000 → "$0.50M"', () => {
  assert.equal(formatMillions(500000), '$0.50M');
});

test('formatMillions: null → "$0.00M"', () => {
  assert.equal(formatMillions(null), '$0.00M');
});

test('formatMillions: undefined → "$0.00M"', () => {
  assert.equal(formatMillions(undefined), '$0.00M');
});

test('formatMillions: NaN → "$0.00M"', () => {
  assert.equal(formatMillions(NaN), '$0.00M');
});

// ─── formatPct ──────────────────────────────────────────────────────────────

test('formatPct: 0.76 → "76%"', () => {
  assert.equal(formatPct(0.76), '76%');
});

test('formatPct: 1.0 → "100%"', () => {
  assert.equal(formatPct(1.0), '100%');
});

test('formatPct: 0 → "0%"', () => {
  assert.equal(formatPct(0), '0%');
});

test('formatPct: 0.333 → "33%"', () => {
  assert.equal(formatPct(0.333), '33%');
});

test('formatPct: 0.999 → "100%"', () => {
  assert.equal(formatPct(0.999), '100%');
});

test('formatPct: null → "0%"', () => {
  assert.equal(formatPct(null), '0%');
});

test('formatPct: undefined → "0%"', () => {
  assert.equal(formatPct(undefined), '0%');
});

// ─── ragClass ───────────────────────────────────────────────────────────────

test('ragClass: "r" → "cell-r"', () => {
  assert.equal(ragClass('r'), 'cell-r');
});

test('ragClass: "a" → "cell-a"', () => {
  assert.equal(ragClass('a'), 'cell-a');
});

test('ragClass: "g" → "cell-g"', () => {
  assert.equal(ragClass('g'), 'cell-g');
});

test('ragClass: null → "cell-g" (default)', () => {
  assert.equal(ragClass(null), 'cell-g');
});

test('ragClass: undefined → "cell-g" (default)', () => {
  assert.equal(ragClass(undefined), 'cell-g');
});

test('ragClass: invalid value → "cell-g" (default)', () => {
  assert.equal(ragClass('x'), 'cell-g');
});

test('RAG_LABEL matches heatmap wording', () => {
  assert.equal(RAG_LABEL.g, 'On Track');
  assert.equal(RAG_LABEL.a, 'At Risk');
  assert.equal(RAG_LABEL.r, 'Critical');
});


// ─── deriveInitiativeRag ────────────────────────────────────────────────────

test('deriveInitiativeRag: P1 signal → returns "r"', () => {
  const signals = [
    { initiativeId: 'init-001', priority: 1, id: 'sig-1' },
    { initiativeId: 'init-001', priority: 3, id: 'sig-2' },
  ];
  assert.equal(deriveInitiativeRag('init-001', signals), 'r');
});

test('deriveInitiativeRag: P2 signal (no P1) → returns "a"', () => {
  const signals = [
    { initiativeId: 'init-002', priority: 2, id: 'sig-1' },
    { initiativeId: 'init-002', priority: 4, id: 'sig-2' },
  ];
  assert.equal(deriveInitiativeRag('init-002', signals), 'a');
});

test('deriveInitiativeRag: no P1/P2 signals → returns "g"', () => {
  const signals = [
    { initiativeId: 'init-003', priority: 3, id: 'sig-1' },
    { initiativeId: 'init-003', priority: 4, id: 'sig-2' },
  ];
  assert.equal(deriveInitiativeRag('init-003', signals), 'g');
});

test('deriveInitiativeRag: signals for other initiatives are ignored', () => {
  const signals = [
    { initiativeId: 'init-999', priority: 1, id: 'sig-1' },
    { initiativeId: 'init-888', priority: 2, id: 'sig-2' },
    { initiativeId: 'init-001', priority: 4, id: 'sig-3' },
  ];
  assert.equal(deriveInitiativeRag('init-001', signals), 'g');
});

test('deriveInitiativeRag: empty signals array → "g"', () => {
  assert.equal(deriveInitiativeRag('init-001', []), 'g');
});
