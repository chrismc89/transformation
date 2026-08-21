/**
 * Integration tests for lambda/read-initiatives.js
 * Mocks S3Client.prototype.send via node:test's built-in t.mock.method()
 *
 * Validates: Requirements 4.1, 4.4, 4.5
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { S3Client } from '@aws-sdk/client-s3';
import { handler } from '../lambda/read-initiatives.js';

describe('Lambda: read-initiatives', () => {
  beforeEach(() => {
    process.env.S3_BUCKET = 'test-bucket';
    process.env.S3_KEY = 'initiatives.json';
    process.env.ALLOWED_ORIGIN = 'https://test.amplifyapp.com';
  });

  afterEach(() => {
    delete process.env.S3_BUCKET;
    delete process.env.S3_KEY;
    delete process.env.ALLOWED_ORIGIN;
  });

  it('returns HTTP 200 with parsed array on successful read', async (t) => {
    const mockData = [
      { id: 'init-001', name: 'Initiative A' },
      { id: 'init-002', name: 'Initiative B' },
    ];

    t.mock.method(S3Client.prototype, 'send', async () => ({
      Body: { transformToString: async () => JSON.stringify(mockData) },
    }));

    const result = await handler({ httpMethod: 'GET' });

    assert.equal(result.statusCode, 200);
    assert.deepEqual(JSON.parse(result.body), mockData);
  });

  it('returns HTTP 200 with empty array when S3 object does not exist (NoSuchKey)', async (t) => {
    t.mock.method(S3Client.prototype, 'send', async () => {
      const err = new Error('The specified key does not exist.');
      err.name = 'NoSuchKey';
      throw err;
    });

    const result = await handler({ httpMethod: 'GET' });

    assert.equal(result.statusCode, 200);
    assert.deepEqual(JSON.parse(result.body), []);
  });

  it('returns HTTP 500 on unexpected S3 error', async (t) => {
    t.mock.method(S3Client.prototype, 'send', async () => {
      throw new Error('Internal S3 failure');
    });

    const result = await handler({ httpMethod: 'GET' });

    assert.equal(result.statusCode, 500);
    const body = JSON.parse(result.body);
    assert.ok(body.error);
  });
});
