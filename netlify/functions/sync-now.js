// sync-now.js — Manual trigger for sync
// HTTP GET trigger that runs the same sync logic as sync-daily
// For testing — calls the sync handler directly

import { runSync, corsHeaders, corsResponse, checkToken } from './_lib.js';

export default async function handler(req) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: corsHeaders });
  }

  // Optional token gate
  const denied = checkToken(req);
  if (denied) return denied;

  console.log('sync-now: manual sync triggered');

  try {
    const url = new URL(req.url);
    const days = parseInt(url.searchParams.get('days') || '5', 10);
    const result = await runSync(days);
    console.log('sync-now: complete', JSON.stringify(result));
    return corsResponse(result);
  } catch (err) {
    console.error('sync-now: unexpected error', err);
    return corsResponse({ error: err.message }, 500);
  }
}
