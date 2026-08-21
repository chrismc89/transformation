/**
 * Lambda: PUT /api/initiatives
 * Accepts a JSON body (array of initiative objects) and writes to S3.
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({});
const BUCKET = process.env.S3_BUCKET;
const KEY = process.env.S3_KEY || 'initiatives.json';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://origin-not-configured.invalid';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'PUT,OPTIONS',
};

export async function handler(event) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  try {
    // Parse and validate body
    let initiatives;
    try {
      initiatives = JSON.parse(event.body);
    } catch (parseErr) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Invalid JSON body', message: parseErr.message }),
      };
    }

    if (!Array.isArray(initiatives)) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Body must be a JSON array of initiative objects' }),
      };
    }

    // Basic schema validation — each item must look like an initiative
    const invalid = initiatives.filter(
      (item) => !item || typeof item !== 'object' || !item.id || !item.name || typeof item.savings !== 'object'
    );
    if (invalid.length > 0) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: 'Invalid initiative objects in array',
          message: `${invalid.length} item(s) missing required fields (id, name, savings object)`,
        }),
      };
    }

    // Write to S3
    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: KEY,
      Body: JSON.stringify(initiatives),
      ContentType: 'application/json',
    });
    await s3.send(command);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: true }),
    };
  } catch (err) {
    console.error('[write-initiatives] Error:', err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Failed to write initiatives', message: err.message }),
    };
  }
}
