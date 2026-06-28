// _lib.js — Shared helpers for One More backend
// Blobs storage, OAuth token management, API data pulls, CORS

import { getStore } from '@netlify/blobs';

// ── Blobs helpers ──────────────────────────────────────────────────────────

export function store() {
  return getStore('ctm-data');
}

export async function readJSON(key, fallback = {}) {
  try {
    const raw = await store().get(key);
    if (raw === null || raw === undefined) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export async function writeJSON(key, value) {
  await store().set(key, JSON.stringify(value));
}

export async function mergeInto(key, entries) {
  const existing = await readJSON(key, {});
  let changed = 0;
  for (const [date, val] of Object.entries(entries)) {
    const prev = existing[date];
    if (!prev || JSON.stringify(prev) !== JSON.stringify({ ...prev, ...val })) {
      existing[date] = { ...prev, ...val };
      changed++;
    }
  }
  if (changed > 0) await writeJSON(key, existing);
  return changed;
}

// ── CORS ───────────────────────────────────────────────────────────────────

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export function corsResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

// ── Token gate ─────────────────────────────────────────────────────────────

export function checkToken(req) {
  const token = new URL(req.url).searchParams.get('token') || '';
  if (process.env.DATA_TOKEN && token !== process.env.DATA_TOKEN) {
    return corsResponse({ error: 'unauthorized' }, 401);
  }
  return null; // authorized
}

// ── WHOOP OAuth + data pull ────────────────────────────────────────────────

export async function whoopAccessToken() {
  // Try stored refresh token first, fall back to env seed
  const storedRefresh = await readJSON('whoop_refresh', null);
  const refreshToken = storedRefresh || process.env.WHOOP_REFRESH_TOKEN;

  if (!refreshToken) throw new Error('No WHOOP refresh token available');

  const res = await fetch('https://api.prod.whoop.com/oauth/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.WHOOP_CLIENT_ID,
      client_secret: process.env.WHOOP_CLIENT_SECRET,
      refresh_token: refreshToken,
      scope: 'offline read:recovery read:sleep read:profile',
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WHOOP token refresh failed (${res.status}): ${text}`);
  }

  const data = await res.json();

  // Persist rotated refresh token if the response includes one
  if (data.refresh_token) {
    await writeJSON('whoop_refresh', data.refresh_token);
  }

  return data.access_token;
}

export async function whoopRecovery(since) {
  const token = await whoopAccessToken();
  const sinceISO = since.toISOString();
  const result = {};
  let nextToken = null;

  do {
    let url = `https://api.prod.whoop.com/developer/v1/recovery?start=${encodeURIComponent(sinceISO)}&limit=25`;
    if (nextToken) url += `&nextToken=${encodeURIComponent(nextToken)}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`WHOOP recovery fetch failed (${res.status}): ${text}`);
    }

    const data = await res.json();
    const records = data.records || [];

    for (const rec of records) {
      const date = (rec.created_at || '').slice(0, 10);
      if (!date) continue;

      const score = rec.score || {};
      const entry = {
        recovery: Math.round(score.recovery_score || 0),
        hrv: Math.round(score.hrv_rmssd_milli || 0),
        rhr: Math.round(score.resting_heart_rate || 0),
        src: 'WHOOP',
      };

      // Extract sleep duration from the associated sleep record if available
      if (rec.sleep && rec.sleep.id) {
        const sleepScore = rec.sleep.score || rec.sleep;
        // Sleep duration comes in milliseconds from the sleep object
        if (sleepScore.total_in_bed_time_milli) {
          entry.sleep = +(sleepScore.total_in_bed_time_milli / 3600000).toFixed(1);
        } else if (sleepScore.stage_summary && sleepScore.stage_summary.total_in_bed_time_milli) {
          entry.sleep = +(sleepScore.stage_summary.total_in_bed_time_milli / 3600000).toFixed(1);
        }
      }

      result[date] = entry;
    }

    nextToken = data.next_token || null;
  } while (nextToken);

  return result;
}

// ── Strava OAuth + data pull ───────────────────────────────────────────────

export async function stravaAccessToken() {
  // Try stored refresh token first, fall back to env seed
  const storedRefresh = await readJSON('strava_refresh', null);
  const refreshToken = storedRefresh || process.env.STRAVA_REFRESH_TOKEN;

  if (!refreshToken) throw new Error('No Strava refresh token available');

  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Strava token refresh failed (${res.status}): ${text}`);
  }

  const data = await res.json();

  // Persist rotated refresh token
  if (data.refresh_token) {
    await writeJSON('strava_refresh', data.refresh_token);
  }

  return data.access_token;
}

/**
 * Convert Strava average_speed (meters/sec) to pace string (m:ss per mile).
 * Rounds seconds before formatting to avoid ":60" in the output.
 */
function formatPace(avgSpeedMps) {
  if (!avgSpeedMps || avgSpeedMps <= 0) return '';
  // seconds per mile
  const secPerMile = 1609.344 / avgSpeedMps;
  const mins = Math.floor(secPerMile / 60);
  let secs = Math.round(secPerMile % 60);

  // Handle rounding to 60 seconds
  if (secs === 60) {
    return `${mins + 1}:00`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

/**
 * Convert seconds to time string: h:mm:ss if >= 1hr, else mm:ss.
 */
function formatTime(totalSeconds) {
  if (!totalSeconds || totalSeconds <= 0) return '';
  // Round total seconds first to avoid :60 in any position
  const total = Math.round(totalSeconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export async function stravaRuns(since) {
  const token = await stravaAccessToken();
  const afterEpoch = Math.floor(since.getTime() / 1000);
  const result = {};
  let page = 1;

  while (true) {
    const url = `https://www.strava.com/api/v3/athlete/activities?after=${afterEpoch}&page=${page}&per_page=100`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Strava activities fetch failed (${res.status}): ${text}`);
    }

    const activities = await res.json();
    if (!activities.length) break;

    for (const act of activities) {
      if (act.type !== 'Run') continue;

      const date = (act.start_date_local || act.start_date || '').slice(0, 10);
      if (!date) continue;

      const distMiles = +(act.distance / 1609.344).toFixed(2);

      // Per date, keep the LONGEST run
      if (result[date] && result[date].dist >= distMiles) continue;

      result[date] = {
        dist: distMiles,
        time: formatTime(act.moving_time || act.elapsed_time || 0),
        pace: formatPace(act.average_speed),
        hr: act.average_heartrate ? Math.round(act.average_heartrate) : null,
        src: 'Strava',
      };
    }

    // If we got fewer than 100, no more pages
    if (activities.length < 100) break;
    page++;
  }

  return result;
}

// ── FatSecret OAuth + search + diary ───────────────────────────────────────

export async function fatsecretAccessToken() {
  const clientId = process.env.FATSECRET_CLIENT_ID;
  const clientSecret = process.env.FATSECRET_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('FatSecret client credentials not configured');
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch('https://oauth.fatsecret.com/connect/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'basic',
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FatSecret token request failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.access_token;
}

/**
 * Parse macros from a FatSecret food_description string.
 * Format: "Per <serving> - Calories: 230kcal | Fat: 8.00g | Carbs: 29.00g | Protein: 10.00g"
 */
function parseFoodDescription(desc) {
  if (!desc) return {};
  const cal = desc.match(/Calories:\s*([\d.]+)/i);
  const fat = desc.match(/Fat:\s*([\d.]+)/i);
  const carbs = desc.match(/Carbs:\s*([\d.]+)/i);
  const protein = desc.match(/Protein:\s*([\d.]+)/i);
  return {
    kcal: cal ? Math.round(+cal[1]) : 0,
    p: protein ? Math.round(+protein[1]) : 0,
    c: carbs ? Math.round(+carbs[1]) : 0,
    f: fat ? Math.round(+fat[1]) : 0,
  };
}

export async function fatsecretSearch(query) {
  const token = await fatsecretAccessToken();

  const url = `https://platform.fatsecret.com/rest/server.api?method=foods.search.v3&search_expression=${encodeURIComponent(query)}&format=json&max_results=20`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FatSecret search failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const foods = data.foods_search?.results?.food || data.foods_search?.food || [];

  // Normalize to an array (FatSecret returns a single object if only one result)
  const foodArray = Array.isArray(foods) ? foods : [foods];

  return foodArray.map((f) => {
    // Try to get macros from first serving
    let macros = {};
    const servings = f.servings?.serving;
    if (servings) {
      const serving = Array.isArray(servings) ? servings[0] : servings;
      macros = {
        kcal: Math.round(+(serving.calories || 0)),
        p: Math.round(+(serving.protein || 0)),
        c: Math.round(+(serving.carbohydrate || 0)),
        f: Math.round(+(serving.fat || 0)),
      };
    } else {
      // Fall back to parsing food_description
      macros = parseFoodDescription(f.food_description);
    }

    const name = f.brand_name ? `${f.food_name} (${f.brand_name})` : f.food_name;

    return {
      id: f.food_id,
      name,
      ...macros,
    };
  });
}

export async function fatsecretFoodDiary(startDate, endDate) {
  // Requires 3-legged user token; skip cleanly if not configured
  const userToken = process.env.FATSECRET_USER_TOKEN;
  const userSecret = process.env.FATSECRET_USER_SECRET;
  if (!userToken || !userSecret) return {};

  const token = await fatsecretAccessToken();
  const result = {};

  // Iterate day by day
  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    const dateStr = current.toISOString().slice(0, 10);
    // FatSecret uses days-since-epoch for date param
    const daysSinceEpoch = Math.floor(current.getTime() / 86400000);

    try {
      const url = `https://platform.fatsecret.com/rest/server.api?method=food_entries.get.v2&date=${daysSinceEpoch}&format=json`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          // 3-legged token passed via OAuth user credentials
          'X-User-Token': userToken,
        },
      });

      if (res.ok) {
        const data = await res.json();
        const entries = data.food_entries?.food_entry || [];
        const entryArray = Array.isArray(entries) ? entries : [entries];

        if (entryArray.length > 0) {
          result[dateStr] = {
            entries: entryArray.map((e) => ({
              name: e.food_entry_name || e.food_name || '',
              kcal: Math.round(+(e.calories || 0)),
              p: Math.round(+(e.protein || 0)),
              c: Math.round(+(e.carbohydrate || 0)),
              f: Math.round(+(e.fat || 0)),
            })),
            src: 'FatSecret',
          };
        }
      }
    } catch {
      // Skip individual days that fail
    }

    current.setDate(current.getDate() + 1);
  }

  return result;
}

// ── Sync core logic (shared by sync-daily and sync-now) ────────────────────

export async function runSync(days = 5) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const errors = [];
  const syncResult = { ran: new Date().toISOString() };

  // 1. WHOOP recovery
  try {
    const recovery = await whoopRecovery(since);
    const count = await mergeInto('recovery', recovery);
    syncResult.whoop = { count, ok: true };
  } catch (err) {
    syncResult.whoop = { count: 0, ok: false };
    errors.push(`WHOOP: ${err.message}`);
  }

  // 2. Strava runs
  try {
    const runs = await stravaRuns(since);
    const count = await mergeInto('runs', runs);
    syncResult.strava = { count, ok: true };
  } catch (err) {
    syncResult.strava = { count: 0, ok: false };
    errors.push(`Strava: ${err.message}`);
  }

  // 3. FatSecret diary
  try {
    const endDate = new Date().toISOString().slice(0, 10);
    const startDate = since.toISOString().slice(0, 10);
    const diary = await fatsecretFoodDiary(startDate, endDate);

    // For food, we replace per-date (not merge entries)
    const existing = await readJSON('food', {});
    let foodCount = 0;
    for (const [date, val] of Object.entries(diary)) {
      existing[date] = val;
      foodCount++;
    }
    if (foodCount > 0) await writeJSON('food', existing);

    syncResult.food = { count: foodCount, ok: true };
  } catch (err) {
    syncResult.food = { count: 0, ok: false };
    errors.push(`FatSecret: ${err.message}`);
  }

  syncResult.errors = errors;

  // Write sync result
  await writeJSON('last_sync', syncResult);

  return syncResult;
}
