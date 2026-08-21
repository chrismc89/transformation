/**
 * Tests for pipeline-view logic.
 * Since renderPipeline uses DOM APIs (not available in Node.js),
 * we test the internal logic: stage mapping, sync freshness,
 * date formatting, and dollar formatting.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initiatives } from '../data/demo-fixtures.js';
import { formatMillions } from '../views/view-manager.js';

// ─── Stage Badge Mapping (replicates pipeline-view internal logic) ──────────

const STAGE_CLASS = {
  identified: 'stage-identified',
  validated: 'stage-validated',
  negotiating: 'stage-negotiating',
  implementing: 'stage-implementing',
  realized: 'stage-realized',
};

const STAGE_LABEL = {
  identified: 'Identified',
  validated: 'Validated',
  negotiating: 'Negotiating',
  implementing: 'Implementing',
  realized: 'Realized',
};

// ─── Sync Freshness Logic (replicates pipeline-view internal logic) ─────────

function isSyncStale(lastSyncedAt, staleActivityDays) {
  if (!lastSyncedAt) return true;
  const syncDate = new Date(lastSyncedAt);
  if (isNaN(syncDate.getTime())) return true;
  const now = new Date();
  const diffMs = now - syncDate;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays > staleActivityDays;
}

// ─── Date Formatting (replicates pipeline-view internal logic) ──────────────

function formatDate(isoDate) {
  if (!isoDate) return '—';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return '—';
  return d.toISOString().slice(0, 10);
}

// ─── Stage Badge Tests ──────────────────────────────────────────────────────

test('Stage badge: all 5 stages have distinct CSS classes', () => {
  const classes = Object.values(STAGE_CLASS);
  const uniqueClasses = new Set(classes);
  assert.equal(uniqueClasses.size, 5);
});

test('Stage badge: implementing maps to stage-implementing', () => {
  assert.equal(STAGE_CLASS['implementing'], 'stage-implementing');
});

test('Stage badge: identified maps to stage-identified', () => {
  assert.equal(STAGE_CLASS['identified'], 'stage-identified');
});

test('Stage badge: validated maps to stage-validated', () => {
  assert.equal(STAGE_CLASS['validated'], 'stage-validated');
});

test('Stage badge: negotiating maps to stage-negotiating', () => {
  assert.equal(STAGE_CLASS['negotiating'], 'stage-negotiating');
});

test('Stage badge: realized maps to stage-realized', () => {
  assert.equal(STAGE_CLASS['realized'], 'stage-realized');
});

test('Stage badge: labels match expected capitalized values', () => {
  assert.equal(STAGE_LABEL['identified'], 'Identified');
  assert.equal(STAGE_LABEL['validated'], 'Validated');
  assert.equal(STAGE_LABEL['negotiating'], 'Negotiating');
  assert.equal(STAGE_LABEL['implementing'], 'Implementing');
  assert.equal(STAGE_LABEL['realized'], 'Realized');
});

// ─── Sync Freshness Tests ───────────────────────────────────────────────────

test('Sync freshness: null lastSyncedAt is stale', () => {
  assert.equal(isSyncStale(null, 7), true);
});

test('Sync freshness: invalid date string is stale', () => {
  assert.equal(isSyncStale('not-a-date', 7), true);
});

test('Sync freshness: sync 1 day ago is fresh (threshold 7 days)', () => {
  const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(isSyncStale(oneDayAgo, 7), false);
});

test('Sync freshness: sync 6 days ago is fresh (threshold 7 days)', () => {
  const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(isSyncStale(sixDaysAgo, 7), false);
});

test('Sync freshness: sync 8 days ago is stale (threshold 7 days)', () => {
  const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(isSyncStale(eightDaysAgo, 7), true);
});

test('Sync freshness: sync exactly at threshold boundary is fresh', () => {
  // 7 days exactly should not be stale (not > 7)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(isSyncStale(sevenDaysAgo, 7), false);
});

// ─── Date Formatting Tests ──────────────────────────────────────────────────

test('formatDate: ISO date string returns YYYY-MM-DD', () => {
  assert.equal(formatDate('2026-10-15'), '2026-10-15');
});

test('formatDate: full ISO timestamp returns date portion', () => {
  assert.equal(formatDate('2026-08-12T10:00:00Z'), '2026-08-12');
});

test('formatDate: null returns dash', () => {
  assert.equal(formatDate(null), '—');
});

test('formatDate: undefined returns dash', () => {
  assert.equal(formatDate(undefined), '—');
});

test('formatDate: invalid string returns dash', () => {
  assert.equal(formatDate('not-a-date'), '—');
});

// ─── Dollar Formatting Tests ────────────────────────────────────────────────

test('formatMillions: initiative savings values format correctly', () => {
  // init-001: target $3.2M
  assert.equal(formatMillions(3200000), '$3.20M');
  // init-006: target $4.5M
  assert.equal(formatMillions(4500000), '$4.50M');
  // init-004: target $400K
  assert.equal(formatMillions(400000), '$0.40M');
});

test('formatMillions: zero formats as $0.00M', () => {
  assert.equal(formatMillions(0), '$0.00M');
});

// ─── Initiative Data Coverage Tests ─────────────────────────────────────────

test('All 13 initiatives have valid stage values', () => {
  const validStages = new Set(Object.keys(STAGE_CLASS));
  for (const init of initiatives) {
    assert.ok(validStages.has(init.stage), `${init.name} has invalid stage: ${init.stage}`);
  }
});

test('All 13 initiatives have savings object with target/validated/realized', () => {
  for (const init of initiatives) {
    assert.ok(init.savings, `${init.name} missing savings object`);
    assert.ok(typeof init.savings.target === 'number', `${init.name} missing target`);
    assert.ok(typeof init.savings.validated === 'number', `${init.name} missing validated`);
    assert.ok(typeof init.savings.realized === 'number', `${init.name} missing realized`);
  }
});

test('All 13 initiatives have dueDate and lastSyncedAt', () => {
  for (const init of initiatives) {
    assert.ok(init.dueDate, `${init.name} missing dueDate`);
    assert.ok(init.lastSyncedAt, `${init.name} missing lastSyncedAt`);
  }
});

test('Pipeline covers all 5 stages across initiatives', () => {
  const stagesUsed = new Set(initiatives.map(i => i.stage));
  assert.equal(stagesUsed.size, 5);
  assert.ok(stagesUsed.has('identified'));
  assert.ok(stagesUsed.has('validated'));
  assert.ok(stagesUsed.has('negotiating'));
  assert.ok(stagesUsed.has('implementing'));
  assert.ok(stagesUsed.has('realized'));
});
