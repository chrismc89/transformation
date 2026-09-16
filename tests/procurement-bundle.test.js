import { test } from 'node:test';
import assert from 'node:assert/strict';
import ProcurementBundle from '../domains/procurement-bundle.js';

test('procurement bundle does not include the portfolio owner-concentration stub', () => {
  const ids = ProcurementBundle.evaluators.map((e) => e.id);
  assert.equal(ids.includes('owner-concentration'), false);
});
