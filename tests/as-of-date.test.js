import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveAsOfDate } from '../core/as-of-date.js';

test('live mode uses the provided current date, not the fixture week', () => {
  const now = new Date('2026-09-16T15:00:00Z');
  const result = resolveAsOfDate(true, '2026-08-10', now);
  assert.equal(result, now);
});

test('demo mode pins asOfDate to the fixture week at noon UTC', () => {
  const now = new Date('2026-09-16T15:00:00Z');
  const result = resolveAsOfDate(false, '2026-08-10', now);
  assert.equal(result.toISOString(), '2026-08-10T12:00:00.000Z');
});

test('demo mode without weekOf falls back to now', () => {
  const now = new Date('2026-09-16T15:00:00Z');
  const result = resolveAsOfDate(false, undefined, now);
  assert.equal(result, now);
});
