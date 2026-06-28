// data.js — GET /data endpoint
// Returns { recovery, runs, food, lastSync } from Blobs
// This is the endpoint pullBackend() calls from the client

import { readJSON, corsHeaders, corsResponse, checkToken } from './_lib.js';

export default async function handler(req) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: corsHeaders });
  }

  // Optional token gate
  const denied = checkToken(req);
  if (denied) return denied;

  try {
    const [recovery, runs, food, lastSync] = await Promise.all([
      readJSON('recovery', {}),
      readJSON('runs', {}),
      readJSON('food', {}),
      readJSON('last_sync', null),
    ]);

    return corsResponse({ recovery, runs, food, lastSync });
  } catch (err) {
    console.error('data.js error:', err);
    return corsResponse({ error: 'Failed to read data', detail: err.message }, 500);
  }
}
