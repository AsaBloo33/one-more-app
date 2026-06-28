// sync-daily.js — Scheduled job (cron)
// Runs daily at 11:00 UTC (configured in netlify.toml)
// Pulls trailing 5-day window from each provider independently

import { runSync } from './_lib.js';

export default async function handler() {
  console.log('sync-daily: starting scheduled sync');

  try {
    const result = await runSync(5);
    console.log('sync-daily: complete', JSON.stringify(result));
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('sync-daily: unexpected error', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export const config = {
  schedule: '0 11 * * *',
};
