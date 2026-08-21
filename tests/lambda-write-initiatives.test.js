/**
 * Integration tests for lambda/write-initiatives.js
 * Mocks S3Client.prototype.send via node:test's built-in t.mock.method()
 *
 * Validates: Requirements 4.2, 4.4, 4.5
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { S3Client } from '@aws-sdk/client-s3';
import { handler } from '../lambda/write-initiatives.js';

describe('Lambda: write-initiatives', () => {
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

  it('writes a valid array body successfully and returns HTTP 200', async (t) => {
    t.mock.method(S3Client.prototype, 'send', async () => ({}));

    const initiatives = [
      { id: 'init-001', name: 'Initiative A', savings: { target: 1000000, validated: 500000, realized: 0, baseline: 1000000 } },
      { id: 'init-002', name: 'Initiative B', savings: { target: 2000000, validated: 1000000, realized: 0, baseline: 2000000 } },
    ];

    const result = await handler({
      httpMethod: 'PUT',
      body: JSON.stringify(initiatives),
    });

    assert.equal(result.statusCode, 200);
    assert.deepEqual(JSON.parse(result.body), { success: true });
  });

  it('returns HTTP 400 when body is a non-array JSON value', async (t) => {
    t.mock.method(S3Client.prototype, 'send', async () => ({}));

    const result = await handler({
      httpMethod: 'PUT',
      body: JSON.stringify({ name: 'not an array' }),
    });

    assert.equal(result.statusCode, 400);
    const body = JSON.parse(result.body);
    assert.ok(body.error);
    assert.ok(body.error.includes('array'));
  });

  it('returns HTTP 400 when body is malformed JSON', async (t) => {
    t.mock.method(S3Client.prototype, 'send', async () => ({}));

    const result = await handler({
      httpMethod: 'PUT',
      body: '{not valid json!!}',
    });

    assert.equal(result.statusCode, 400);
    const body = JSON.parse(result.body);
    assert.ok(body.error);
  });
});
