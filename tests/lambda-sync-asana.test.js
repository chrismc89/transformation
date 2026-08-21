/**
 * Integration tests for lambda/sync-asana.js
 * Mocks S3Client.prototype.send and globalThis.fetch via node:test's built-in t.mock.method()
 *
 * Validates: Requirements 4.3, 4.4, 4.5
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { S3Client } from '@aws-sdk/client-s3';
import { handler } from '../lambda/sync-asana.js';

describe('Lambda: sync-asana', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    process.env.S3_BUCKET = 'test-bucket';
    process.env.S3_KEY = 'initiatives.json';
    process.env.ALLOWED_ORIGIN = 'https://test.amplifyapp.com';
    process.env.ASANA_TOKEN = 'test-token-123';
    process.env.ASANA_FIELD_BASELINE = 'cf_baseline';
    process.env.ASANA_FIELD_TARGET = 'cf_target';
    process.env.ASANA_FIELD_VALIDATED = 'cf_validated';
    process.env.ASANA_FIELD_REALIZED = 'cf_realized';
    process.env.ASANA_FIELD_STAGE = 'cf_stage';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.S3_BUCKET;
    delete process.env.S3_KEY;
    delete process.env.ALLOWED_ORIGIN;
    delete process.env.ASANA_PROJECT_ID;
    delete process.env.ASANA_TOKEN;
    delete process.env.ASANA_FIELD_BASELINE;
    delete process.env.ASANA_FIELD_TARGET;
    delete process.env.ASANA_FIELD_VALIDATED;
    delete process.env.ASANA_FIELD_REALIZED;
    delete process.env.ASANA_FIELD_STAGE;
  });

  it('returns HTTP 400 when ASANA_PROJECT_ID is not set', async (t) => {
    // Explicitly ensure ASANA_PROJECT_ID is not set
    delete process.env.ASANA_PROJECT_ID;

    t.mock.method(S3Client.prototype, 'send', async () => ({}));

    const result = await handler({ httpMethod: 'POST' });

    assert.equal(result.statusCode, 400);
    const body = JSON.parse(result.body);
    assert.ok(body.error.includes('ASANA_PROJECT_ID'));
  });

  it('returns HTTP 502 with ASANA_AUTH_FAILED code when Asana returns 401', async (t) => {
    process.env.ASANA_PROJECT_ID = 'proj_test_123';

    // Mock S3 read to return empty array (for readInitiativesFromS3)
    t.mock.method(S3Client.prototype, 'send', async () => ({
      Body: { transformToString: async () => JSON.stringify([]) },
    }));

    // Mock fetch to return 401 (Asana auth failure)
    globalThis.fetch = async () => ({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      headers: new Map(),
    });

    const result = await handler({ httpMethod: 'POST' });

    assert.equal(result.statusCode, 502);
    const body = JSON.parse(result.body);
    assert.equal(body.code, 'ASANA_AUTH_FAILED');
    assert.equal(body.success, false);
  });

  it('returns HTTP 200 on successful sync with merged results written to S3', async (t) => {
    process.env.ASANA_PROJECT_ID = 'proj_test_123';

    const existingInitiatives = [
      { id: 'init-001', name: 'Existing Initiative', asanaGid: 'task_001', savings: { target: 1000000 } },
    ];

    const asanaTasks = [
      {
        gid: 'task_001',
        name: 'Updated Initiative',
        custom_fields: [
          { gid: 'cf_target', number_value: 2000000 },
          { gid: 'cf_stage', enum_value: { name: 'Implementing' } },
        ],
      },
      {
        gid: 'task_002',
        name: 'New From Asana',
        custom_fields: [
          { gid: 'cf_target', number_value: 500000 },
          { gid: 'cf_stage', enum_value: { name: 'Identified' } },
        ],
      },
    ];

    let writeCallBody = null;
    let sendCallCount = 0;

    t.mock.method(S3Client.prototype, 'send', async (command) => {
      sendCallCount++;
      // First call is GetObjectCommand (read existing)
      if (sendCallCount === 1) {
        return {
          Body: { transformToString: async () => JSON.stringify(existingInitiatives) },
        };
      }
      // Second call is PutObjectCommand (write merged)
      writeCallBody = command.input?.Body || null;
      return {};
    });

    // Mock fetch to return Asana tasks
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ data: asanaTasks }),
    });

    const result = await handler({ httpMethod: 'POST' });

    assert.equal(result.statusCode, 200);
    const body = JSON.parse(result.body);
    assert.equal(body.success, true);
    assert.equal(body.updated, 2);
  });
});
