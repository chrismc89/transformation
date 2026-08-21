/**
 * Signal Cascade — Core evaluator runner with P1-P5 priority, dedup, and honest degradation.
 * Same contract as Truetempo's evm-pipeline signal runner, domain-agnostic.
 * @module core/signal-cascade
 */

export function textSimilarity(a, b) {
  const tokenize = (s) => new Set(s.toLowerCase().split(/[\s\W]+/).filter(w => w.length > 0));
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const word of setA) { if (setB.has(word)) intersection++; }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function runSignals(initiatives, bundle, options = {}) {
  const { thresholds, evaluators } = bundle;
  const signals = [];

  for (const initiative of initiatives) {
    const ctx = { initiative, settings: options.settings || {}, asOfDate: options.asOfDate };
    for (const evaluator of evaluators) {
      try {
        const result = evaluator.evaluate(ctx, thresholds);
        if (result && result.length > 0) signals.push(...result);
      } catch (err) {
        console.warn('[Signal] Evaluator ' + evaluator.id + ' threw:', err.message);
      }
    }
  }

  // Dedup Pass 1 — exact id, higher priority wins
  const deduped = new Map();
  for (const signal of signals) {
    const existing = deduped.get(signal.id + ':' + signal.initiativeId);
    if (!existing || signal.priority < existing.priority) {
      deduped.set(signal.id + ':' + signal.initiativeId, signal);
    }
  }

  // Dedup Pass 2 — 72% consequence similarity
  const pass2 = [...deduped.values()];
  const removed = new Set();
  for (let i = 0; i < pass2.length; i++) {
    if (removed.has(i)) continue;
    for (let j = i + 1; j < pass2.length; j++) {
      if (removed.has(j)) continue;
      if (pass2[i].initiativeId !== pass2[j].initiativeId) continue;
      if (textSimilarity(pass2[i].consequence || '', pass2[j].consequence || '') >= 0.72) {
        if (pass2[i].priority <= pass2[j].priority) { removed.add(j); }
        else { removed.add(i); break; }
      }
    }
  }

  return pass2.filter((_, idx) => !removed.has(idx)).sort((a, b) => a.priority - b.priority);
}

export function runPortfolioSignals(initiatives, signals, portfolioBundle, options = {}) {
  const { thresholds, evaluators } = portfolioBundle;
  const ctx = { initiatives, signals, asOfDate: options.asOfDate };

  const portfolioSignals = [];
  for (const evaluator of evaluators) {
    try {
      const result = evaluator.evaluate(ctx, thresholds);
      if (result && result.length > 0) portfolioSignals.push(...result);
    } catch (err) {
      console.warn('[Signal] Portfolio evaluator ' + evaluator.id + ' threw:', err.message);
    }
  }

  // Merge portfolio signals with incoming per-initiative signals
  const merged = [...signals, ...portfolioSignals];

  // Dedup Pass 1 — exact id:initiativeId, higher priority wins
  const deduped = new Map();
  for (const signal of merged) {
    const key = signal.id + ':' + signal.initiativeId;
    const existing = deduped.get(key);
    if (!existing || signal.priority < existing.priority) {
      deduped.set(key, signal);
    }
  }

  // Dedup Pass 2 — 0.72 consequence similarity
  // Portfolio signals (initiativeId: null) only compared against other portfolio signals
  const pass2 = [...deduped.values()];
  const removed = new Set();
  for (let i = 0; i < pass2.length; i++) {
    if (removed.has(i)) continue;
    for (let j = i + 1; j < pass2.length; j++) {
      if (removed.has(j)) continue;
      if (pass2[i].initiativeId !== pass2[j].initiativeId) continue;
      if (textSimilarity(pass2[i].consequence || '', pass2[j].consequence || '') >= 0.72) {
        if (pass2[i].priority <= pass2[j].priority) { removed.add(j); }
        else { removed.add(i); break; }
      }
    }
  }

  return pass2.filter((_, idx) => !removed.has(idx)).sort((a, b) => a.priority - b.priority);
}
