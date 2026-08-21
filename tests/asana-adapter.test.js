import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import AsanaAdapter from '../adapters/asana-adapter.js';

const TEST_CONFIG = {
  projectId: 'proj_123',
  accessTokenRef: 'ASANA_TOKEN',
  fieldMappings: {
    baseline: 'cf_baseline_gid',
    target: 'cf_target_gid',
    validated: 'cf_validated_gid',
    realized: 'cf_realized_gid',
    stage: 'cf_stage_gid',
  },
  stageValueMap: {
    'Identified': 'identified',
    'Validated': 'validated',
    'Negotiating': 'negotiating',
    'Implementing': 'implementing',
    'Realized': 'realized',
  },
};

function makeAsanaTask({ baseline, target, validated, realized, stageName, gid, name } = {}) {
  const custom_fields = [];

  if (baseline !== undefined) {
    custom_fields.push({ gid: 'cf_baseline_gid', number_value: baseline });
  }
  if (target !== undefined) {
    custom_fields.push({ gid: 'cf_target_gid', number_value: target });
  }
  if (validated !== undefined) {
    custom_fields.push({ gid: 'cf_validated_gid', number_value: validated });
  }
  if (realized !== undefined) {
    custom_fields.push({ gid: 'cf_realized_gid', number_value: realized });
  }
  if (stageName !== undefined) {
    custom_fields.push({
      gid: 'cf_stage_gid',
      enum_value: stageName ? { name: stageName } : null,
    });
  }

  return {
    gid: gid || 'task_001',
    name: name || 'Test Initiative',
    custom_fields,
  };
}

describe('AsanaAdapter', () => {
  beforeEach(() => {
    AsanaAdapter.configure(TEST_CONFIG);
  });

  describe('configure()', () => {
    it('should accept a valid configuration object', () => {
      // configure already called in beforeEach — just verify mapFields works after
      const task = makeAsanaTask({ target: 1000000, stageName: 'Validated' });
      const result = AsanaAdapter.mapFields(task);
      assert.equal(result.stage, 'validated');
    });

    it('should use default stageValueMap when not provided', () => {
      AsanaAdapter.configure({
        projectId: 'proj_456',
        accessTokenRef: 'TOKEN',
        fieldMappings: TEST_CONFIG.fieldMappings,
      });
      const task = makeAsanaTask({ stageName: 'Implementing' });
      const result = AsanaAdapter.mapFields(task);
      assert.equal(result.stage, 'implementing');
    });
  });

  describe('mapFields()', () => {
    it('should extract dollar values from custom fields by GID', () => {
      const task = makeAsanaTask({
        baseline: 3200000,
        target: 3200000,
        validated: 2900000,
        realized: 1400000,
        stageName: 'Implementing',
      });

      const result = AsanaAdapter.mapFields(task);

      assert.equal(result.savings.baseline, 3200000);
      assert.equal(result.savings.target, 3200000);
      assert.equal(result.savings.validated, 2900000);
      assert.equal(result.savings.realized, 1400000);
    });

    it('should return 0 for missing dollar fields', () => {
      const task = makeAsanaTask({ stageName: 'Identified' });

      const result = AsanaAdapter.mapFields(task);

      assert.equal(result.savings.baseline, 0);
      assert.equal(result.savings.target, 0);
      assert.equal(result.savings.validated, 0);
      assert.equal(result.savings.realized, 0);
    });

    it('should return 0 for null number_value', () => {
      const task = {
        gid: 'task_x',
        name: 'Null values',
        custom_fields: [
          { gid: 'cf_target_gid', number_value: null },
        ],
      };

      const result = AsanaAdapter.mapFields(task);
      assert.equal(result.savings.target, 0);
    });

    it('should map all five valid stage enum values correctly', () => {
      const stages = ['Identified', 'Validated', 'Negotiating', 'Implementing', 'Realized'];
      const expected = ['identified', 'validated', 'negotiating', 'implementing', 'realized'];

      stages.forEach((stageName, i) => {
        const task = makeAsanaTask({ stageName });
        const result = AsanaAdapter.mapFields(task);
        assert.equal(result.stage, expected[i], `Stage "${stageName}" should map to "${expected[i]}"`);
      });
    });

    it('should default to "identified" for unrecognized stage value', () => {
      const task = makeAsanaTask({ stageName: 'SomeUnknownStage' });
      const result = AsanaAdapter.mapFields(task);
      assert.equal(result.stage, 'identified');
    });

    it('should default to "identified" when stage field has null enum_value', () => {
      const task = {
        gid: 'task_x',
        name: 'Null stage',
        custom_fields: [
          { gid: 'cf_stage_gid', enum_value: null },
        ],
      };

      const result = AsanaAdapter.mapFields(task);
      assert.equal(result.stage, 'identified');
    });

    it('should default to "identified" when stage field is missing entirely', () => {
      const task = {
        gid: 'task_x',
        name: 'No stage field',
        custom_fields: [],
      };

      const result = AsanaAdapter.mapFields(task);
      assert.equal(result.stage, 'identified');
    });

    it('should set lastSyncedAt to a valid ISO timestamp', () => {
      const before = new Date().toISOString();
      const task = makeAsanaTask({ stageName: 'Validated' });
      const result = AsanaAdapter.mapFields(task);
      const after = new Date().toISOString();

      assert.ok(result.lastSyncedAt >= before);
      assert.ok(result.lastSyncedAt <= after);
      // Verify it's a valid ISO string
      assert.ok(!isNaN(Date.parse(result.lastSyncedAt)));
    });

    it('should include task name and GID in the result', () => {
      const task = makeAsanaTask({ gid: 'task_abc', name: 'Steel Consolidation', stageName: 'Validated' });
      const result = AsanaAdapter.mapFields(task);

      assert.equal(result.name, 'Steel Consolidation');
      assert.equal(result.asanaGid, 'task_abc');
    });

    it('should handle empty custom_fields array gracefully', () => {
      const task = { gid: 'task_empty', name: 'Empty', custom_fields: [] };
      const result = AsanaAdapter.mapFields(task);

      assert.equal(result.savings.baseline, 0);
      assert.equal(result.savings.target, 0);
      assert.equal(result.savings.validated, 0);
      assert.equal(result.savings.realized, 0);
      assert.equal(result.stage, 'identified');
    });

    it('should handle missing custom_fields property gracefully', () => {
      const task = { gid: 'task_no_cf', name: 'No CF' };
      const result = AsanaAdapter.mapFields(task);

      assert.equal(result.savings.baseline, 0);
      assert.equal(result.stage, 'identified');
    });
  });

  describe('sync()', () => {
    let originalFetch;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
      process.env.ASANA_TOKEN = 'test-token-123';
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
      delete process.env.ASANA_TOKEN;
    });

    it('should return ASANA_AUTH_FAILED when access token is not in env', async () => {
      delete process.env.ASANA_TOKEN;

      const result = await AsanaAdapter.sync({});

      assert.equal(result.success, false);
      assert.equal(result.error.code, 'ASANA_AUTH_FAILED');
      assert.ok(result.error.message.includes('ASANA_TOKEN'));
    });

    it('should return ASANA_NETWORK_ERROR on fetch exception', async () => {
      globalThis.fetch = async () => { throw new Error('DNS resolution failed'); };

      const result = await AsanaAdapter.sync({});

      assert.equal(result.success, false);
      assert.equal(result.error.code, 'ASANA_NETWORK_ERROR');
      assert.ok(result.error.message.includes('DNS resolution failed'));
    });

    it('should return ASANA_AUTH_FAILED on 401 response', async () => {
      globalThis.fetch = async () => ({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: new Map(),
      });

      const result = await AsanaAdapter.sync({});

      assert.equal(result.success, false);
      assert.equal(result.error.code, 'ASANA_AUTH_FAILED');
      assert.ok(result.error.message.includes('401'));
    });

    it('should return ASANA_AUTH_FAILED on 403 response', async () => {
      globalThis.fetch = async () => ({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        headers: new Map(),
      });

      const result = await AsanaAdapter.sync({});

      assert.equal(result.success, false);
      assert.equal(result.error.code, 'ASANA_AUTH_FAILED');
    });

    it('should return ASANA_RATE_LIMITED on 429 response with retryAfter', async () => {
      globalThis.fetch = async () => ({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: { get: (h) => h === 'Retry-After' ? '30' : null },
      });

      const result = await AsanaAdapter.sync({});

      assert.equal(result.success, false);
      assert.equal(result.error.code, 'ASANA_RATE_LIMITED');
      assert.equal(result.error.retryAfter, 30);
    });

    it('should return ASANA_NETWORK_ERROR for other HTTP errors', async () => {
      globalThis.fetch = async () => ({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: { get: () => null },
      });

      const result = await AsanaAdapter.sync({});

      assert.equal(result.success, false);
      assert.equal(result.error.code, 'ASANA_NETWORK_ERROR');
      assert.ok(result.error.message.includes('500'));
    });

    it('should return updated initiatives on successful sync', async () => {
      const mockTasks = [
        makeAsanaTask({ gid: 'task_1', name: 'Init A', target: 5000000, stageName: 'Validated' }),
        makeAsanaTask({ gid: 'task_2', name: 'Init B', target: 2000000, stageName: 'Implementing' }),
      ];

      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({ data: mockTasks }),
      });

      const store = { getAll: () => [] };
      const result = await AsanaAdapter.sync(store);

      assert.equal(result.success, true);
      assert.equal(result.updated.length, 2);
      assert.equal(result.updated[0].name, 'Init A');
      assert.equal(result.updated[0].savings.target, 5000000);
      assert.equal(result.updated[0].stage, 'validated');
      assert.equal(result.updated[1].name, 'Init B');
      assert.equal(result.updated[1].stage, 'implementing');
      assert.deepEqual(result.errors, []);
    });

    it('should handle empty task list from Asana', async () => {
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({ data: [] }),
      });

      const result = await AsanaAdapter.sync({});

      assert.equal(result.success, true);
      assert.equal(result.updated.length, 0);
      assert.deepEqual(result.errors, []);
    });
  });
});
