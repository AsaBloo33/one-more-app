// backfill.js — One-time history import
// GET /.netlify/functions/backfill?days=N
// Pulls N days of history from all providers
// Not strictly needed since history is embedded in the app,
// but useful for initial population or recovery

import { runSync, corsHeaders, corsResponse, checkToken } from './_lib.js';

export default async function handler(req) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: corsHeaders });
  }

  // Optional token gate
  const denied = checkToken(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const days = parseInt(url.searchParams.get('days') || '90', 10);

  if (days < 1 || days > 365) {
    return corsResponse({ error: 'days must be between 1 and 365' }, 400);
  }

  console.log(`backfill.js: pulling ${days} days of history`);

  try {
    const result = await runSync(days);
    console.log('backfill.js: complete', JSON.stringify(result));
    return corsResponse({ ...result, backfillDays: days });
  } catch (err) {
    console.error('backfill.js: unexpected error', err);
    return corsResponse({ error: err.message }, 500);
  }
}
