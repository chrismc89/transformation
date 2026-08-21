/**
 * Lambda: GET /api/initiatives
 * Reads initiatives.json from S3 and returns the initiative array.
 * Returns an empty array if the file does not exist.
 */

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({});
const BUCKET = process.env.S3_BUCKET;
const KEY = process.env.S3_KEY || 'initiatives.json';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://origin-not-configured.invalid';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
};

export async function handler(event) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  try {
    const command = new GetObjectCommand({ Bucket: BUCKET, Key: KEY });
    const response = await s3.send(command);
    const body = await response.Body.transformToString();
    const initiatives = JSON.parse(body);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify(initiatives),
    };
  } catch (err) {
    // If the file doesn't exist, return empty array
    if (err.name === 'NoSuchKey' || err.Code === 'NoSuchKey') {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify([]),
      };
    }

    console.error('[read-initiatives] Error:', err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Failed to read initiatives', message: err.message }),
    };
  }
}
