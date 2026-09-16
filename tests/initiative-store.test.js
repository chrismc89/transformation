import { test } from 'node:test';
import assert from 'node:assert/strict';
import InitiativeStore from '../models/initiative-store.js';

test('getSummary does not report atRiskCount from a stored rag field', () => {
  InitiativeStore.load([
    { id: 'init-001', workstream: 'IT', savings: { target: 10, validated: 5, realized: 1 }, rag: 'r' },
  ]);
  const summary = InitiativeStore.getSummary();
  assert.equal(summary.count, 1);
  assert.equal('atRiskCount' in summary, false);
  assert.equal(typeof InitiativeStore.getAtRisk, 'undefined');
});
