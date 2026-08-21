/**
 * Verification test for demo-fixtures.js
 * Confirms data integrity: counts, totals, and schema compliance.
 */
import { initiatives, workstreams, programMeta } from '../data/demo-fixtures.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('initiatives array has 13 items', () => {
  assert.equal(initiatives.length, 13);
});

test('workstreams array has 7 items', () => {
  assert.equal(workstreams.length, 7);
});

test('total target savings ~$18.8M', () => {
  const totalTarget = initiatives.reduce((sum, i) => sum + i.savings.target, 0);
  // $18.83M in raw dollars
  assert.ok(totalTarget >= 18_800_000 && totalTarget <= 18_900_000,
    `Expected total target ~$18.8M, got $${(totalTarget / 1_000_000).toFixed(2)}M`);
});

test('total validated savings ~$14.3M', () => {
  const totalValidated = initiatives.reduce((sum, i) => sum + i.savings.validated, 0);
  // $14.30M in raw dollars
  assert.ok(totalValidated >= 14_200_000 && totalValidated <= 14_400_000,
    `Expected total validated ~$14.3M, got $${(totalValidated / 1_000_000).toFixed(2)}M`);
});

test('total realized savings ~$5.35M', () => {
  const totalRealized = initiatives.reduce((sum, i) => sum + i.savings.realized, 0);
  // $5.35M in raw dollars
  assert.ok(totalRealized >= 5_300_000 && totalRealized <= 5_400_000,
    `Expected total realized ~$5.35M, got $${(totalRealized / 1_000_000).toFixed(2)}M`);
});

test('all initiatives have required schema fields', () => {
  const requiredFields = ['id', 'name', 'workstream', 'owner', 'stage', 'savings', 'dueDate', 'asanaProjectId', 'lastSyncedAt', 'createdAt', 'priorValidated'];
  const savingsFields = ['baseline', 'target', 'validated', 'realized'];

  for (const init of initiatives) {
    for (const field of requiredFields) {
      assert.ok(field in init, `Initiative ${init.id} missing field: ${field}`);
    }
    for (const field of savingsFields) {
      assert.ok(field in init.savings, `Initiative ${init.id} savings missing field: ${field}`);
    }
  }
});

test('all initiatives have valid pipeline stages', () => {
  const validStages = ['identified', 'validated', 'negotiating', 'implementing', 'realized'];
  for (const init of initiatives) {
    assert.ok(validStages.includes(init.stage),
      `Initiative ${init.id} has invalid stage: ${init.stage}`);
  }
});

test('workstream summaries have required fields', () => {
  const requiredFields = ['name', 'target', 'validated', 'realized'];
  for (const ws of workstreams) {
    for (const field of requiredFields) {
      assert.ok(field in ws, `Workstream ${ws.name} missing field: ${field}`);
    }
  }
});

test('workstream target totals match initiative totals (~$18.8M)', () => {
  const wsTotal = workstreams.reduce((sum, ws) => sum + ws.target, 0);
  // Workstreams are in $M, so compare directly
  assert.ok(wsTotal >= 18.7 && wsTotal <= 18.9,
    `Expected workstream target total ~$18.8M, got $${wsTotal.toFixed(2)}M`);
});

test('programMeta has correct values', () => {
  assert.equal(programMeta.day, 214);
  assert.equal(programMeta.totalDays, 540);
  assert.equal(programMeta.fyCommitment, 15000000);
  assert.equal(programMeta.weekOf, '2026-08-10');
});

test('all 7 workstreams are represented in initiatives', () => {
  const wsNames = new Set(workstreams.map(ws => ws.name));
  const initWsNames = new Set(initiatives.map(i => i.workstream));
  for (const name of wsNames) {
    assert.ok(initWsNames.has(name),
      `Workstream "${name}" has no initiatives`);
  }
});
