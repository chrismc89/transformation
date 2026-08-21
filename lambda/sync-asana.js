/**
 * Lambda: POST /api/sync OR EventBridge scheduled trigger
 * Orchestrates Asana sync: reads current initiatives from S3, runs AsanaAdapter.sync(),
 * merges updated data, and writes back to S3.
 */

import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import AsanaAdapter from '../adapters/asana-adapter.js';

const s3 = new S3Client({});
const BUCKET = process.env.S3_BUCKET;
const KEY = process.env.S3_KEY || 'initiatives.json';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://origin-not-configured.invalid';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};

/**
 * Read current initiatives from S3. Returns empty array if file doesn't exist.
 */
async function readInitiativesFromS3() {
  try {
    const command = new GetObjectCommand({ Bucket: BUCKET, Key: KEY });
    const response = await s3.send(command);
    const body = await response.Body.transformToString();
    return JSON.parse(body);
  } catch (err) {
    if (err.name === 'NoSuchKey' || err.Code === 'NoSuchKey') {
      return [];
    }
    throw err;
  }
}

/**
 * Write initiatives array to S3.
 */
async function writeInitiativesToS3(initiatives) {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: KEY,
    Body: JSON.stringify(initiatives),
    ContentType: 'application/json',
  });
  await s3.send(command);
}

/**
 * Merge synced task data into existing initiatives array.
 * Matches by asanaGid; updates existing records or appends new ones.
 */
function mergeInitiatives(existing, updated) {
  const merged = [...existing];

  for (const item of updated) {
    const idx = merged.findIndex(
      (init) => init.asanaGid && init.asanaGid === item.asanaGid
    );

    if (idx >= 0) {
      // Update existing initiative with synced data
      merged[idx] = {
        ...merged[idx],
        ...item,
        savings: { ...merged[idx].savings, ...item.savings },
      };
    } else {
      // New initiative from Asana — append with generated id
      merged.push({
        id: `init-asana-${item.asanaGid}`,
        workstream: 'Uncategorized',
        owner: 'Unassigned',
        dueDate: null,
        createdAt: new Date().toISOString(),
        ...item,
      });
    }
  }

  return merged;
}

export async function handler(event) {
  // Handle CORS preflight (API Gateway)
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  try {
    // Configure the Asana adapter from environment variables
    const projectId = process.env.ASANA_PROJECT_ID;
    const accessTokenRef = 'ASANA_TOKEN';

    if (!projectId) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'ASANA_PROJECT_ID environment variable not set' }),
      };
    }

    AsanaAdapter.configure({
      projectId,
      accessTokenRef,
      fieldMappings: {
        baseline: process.env.ASANA_FIELD_BASELINE || '',
        target: process.env.ASANA_FIELD_TARGET || '',
        validated: process.env.ASANA_FIELD_VALIDATED || '',
        realized: process.env.ASANA_FIELD_REALIZED || '',
        stage: process.env.ASANA_FIELD_STAGE || '',
      },
    });

    // Read current initiatives from S3
    const currentInitiatives = await readInitiativesFromS3();

    // Run the Asana sync
    const syncResult = await AsanaAdapter.sync(currentInitiatives);

    // If sync failed, return the error
    if (!syncResult.success) {
      return {
        statusCode: 502,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: syncResult.error.message,
          code: syncResult.error.code,
        }),
      };
    }

    // Merge updated initiatives with existing data
    const merged = mergeInitiatives(currentInitiatives, syncResult.updated);

    // Write back to S3
    await writeInitiativesToS3(merged);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        updated: syncResult.updated.length,
        errors: syncResult.errors,
      }),
    };
  } catch (err) {
    console.error('[sync-asana] Error:', err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Sync failed', message: err.message }),
    };
  }
}
