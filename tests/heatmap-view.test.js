/**
 * Tests for heatmap-view logic.
 * Since renderHeatmap uses DOM APIs (not available in Node.js),
 * we test the RAG derivation logic and percentage calculations
 * that match the module's internal behavior.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initiatives, workstreams } from '../data/demo-fixtures.js';
import { formatMillions, formatPct, ragClass } from '../views/view-manager.js';

// ─── RAG Derivation Logic (replicates heatmap-view internal logic) ──────────

/**
 * Derives RAG for a workstream from signal priorities.
 * P1 → 'r', P2 → 'a', else → 'g'
 */
function deriveWorkstreamRag(workstreamName, inits, signals) {
  const wsInitIds = new Set(
    inits.filter(i => i.workstream === workstreamName).map(i => i.id)
  );

  let worstPriority = Infinity;
  for (const sig of signals) {
    if (wsInitIds.has(sig.initiativeId)) {
      if (sig.priority < worstPriority) {
        worstPriority = sig.priority;
      }
    }
  }

  if (worstPriority <= 1) return 'r';
  if (worstPriority <= 2) return 'a';
  return 'g';
}

// ─── RAG Derivation Tests ───────────────────────────────────────────────────

test('RAG: P1 signal on any initiative in workstream yields red', () => {
  const signals = [
    { priority: 1, initiativeId: 'init-006' }, // Logistics & Freight
  ];
  const rag = deriveWorkstreamRag('Logistics & Freight', initiatives, signals);
  assert.equal(rag, 'r');
});

test('RAG: P2 signal (no P1) on workstream yields amber', () => {
  const signals = [
    { priority: 2, initiativeId: 'init-004' }, // Indirect / MRO
  ];
  const rag = deriveWorkstreamRag('Indirect / MRO', initiatives, signals);
  assert.equal(rag, 'a');
});

test('RAG: No signals targeting workstream yields green', () => {
  const signals = [
    { priority: 1, initiativeId: 'init-006' }, // Different workstream
  ];
  const rag = deriveWorkstreamRag('IT & Telecom', initiatives, signals);
  assert.equal(rag, 'g');
});

test('RAG: P1 overrides P2 when both present in same workstream', () => {
  const signals = [
    { priority: 2, initiativeId: 'init-005' }, // Logistics & Freight
    { priority: 1, initiativeId: 'init-006' }, // Logistics & Freight
  ];
  const rag = deriveWorkstreamRag('Logistics & Freight', initiatives, signals);
  assert.equal(rag, 'r');
});

test('RAG: P3–P5 signals do not affect RAG (stays green)', () => {
  const signals = [
    { priority: 3, initiativeId: 'init-001' }, // Direct Materials
    { priority: 4, initiativeId: 'init-002' }, // Direct Materials
    { priority: 5, initiativeId: 'init-002' }, // Direct Materials
  ];
  const rag = deriveWorkstreamRag('Direct Materials', initiatives, signals);
  assert.equal(rag, 'g');
});

test('RAG: Empty signals array yields green for all workstreams', () => {
  for (const ws of workstreams) {
    const rag = deriveWorkstreamRag(ws.name, initiatives, []);
    assert.equal(rag, 'g', `Expected green for ${ws.name} with no signals`);
  }
});

test('RAG: Signal for initiative not in any workstream is ignored', () => {
  const signals = [
    { priority: 1, initiativeId: 'init-nonexistent' },
  ];
  const rag = deriveWorkstreamRag('Direct Materials', initiatives, signals);
  assert.equal(rag, 'g');
});

// ─── Percentage Calculation Tests ───────────────────────────────────────────

test('% to Target: validated/target formatted as whole number percent', () => {
  // Direct Materials: validated 3.5 / target 4.3 = 81%
  const ws = workstreams[0]; // Direct Materials
  const pct = ws.target > 0 ? ws.validated / ws.target : 0;
  assert.equal(formatPct(pct), '81%');
});

test('% to Target: 100% when validated equals target', () => {
  const pct = 1.0 / 1.0;
  assert.equal(formatPct(pct), '100%');
});

test('% to Target: 0% when validated is zero', () => {
  const pct = 0 / 4.3;
  assert.equal(formatPct(pct), '0%');
});

test('% to Target: handles zero target gracefully (returns 0%)', () => {
  const pct = 0; // Guard: when target is 0, use 0 ratio
  assert.equal(formatPct(pct), '0%');
});

// ─── Initiative Count Tests ─────────────────────────────────────────────────

test('Initiative count: Direct Materials has 2 initiatives', () => {
  const count = initiatives.filter(i => i.workstream === 'Direct Materials').length;
  assert.equal(count, 2);
});

test('Initiative count: Logistics & Freight has 2 initiatives', () => {
  const count = initiatives.filter(i => i.workstream === 'Logistics & Freight').length;
  assert.equal(count, 2);
});

test('Initiative count: total across all 7 workstreams is 13', () => {
  const wsNames = workstreams.map(w => w.name);
  const total = initiatives.filter(i => wsNames.includes(i.workstream)).length;
  assert.equal(total, 13);
});

// ─── CSS Class Mapping Tests ────────────────────────────────────────────────

test('ragClass maps "r" to "cell-r"', () => {
  assert.equal(ragClass('r'), 'cell-r');
});

test('ragClass maps "a" to "cell-a"', () => {
  assert.equal(ragClass('a'), 'cell-a');
});

test('ragClass maps "g" to "cell-g"', () => {
  assert.equal(ragClass('g'), 'cell-g');
});

test('ragClass defaults to "cell-g" for invalid input', () => {
  assert.equal(ragClass(null), 'cell-g');
  assert.equal(ragClass('x'), 'cell-g');
  assert.equal(ragClass(''), 'cell-g');
});

// ─── Formatting Tests ───────────────────────────────────────────────────────

test('formatMillions: workstream target values display correctly', () => {
  // Workstreams store values in $M, so multiply by 1M for formatMillions
  assert.equal(formatMillions(4.3 * 1_000_000), '$4.30M');
  assert.equal(formatMillions(6.9 * 1_000_000), '$6.90M');
  assert.equal(formatMillions(0.61 * 1_000_000), '$0.61M');
});
