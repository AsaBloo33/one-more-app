// auth.js — One-time OAuth helper to capture refresh tokens
// GET /.netlify/functions/auth?provider=strava|whoop
// Step 1: no 'code' param → redirect to provider's authorization URL
// Step 2: 'code' param present → exchange for tokens, save refresh token, return success

import { writeJSON, corsHeaders } from './_lib.js';

function htmlResponse(body, status = 200) {
  return new Response(body, {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
  });
}

export default async function handler(req) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const provider = url.searchParams.get('provider');
  const code = url.searchParams.get('code');

  // Determine the redirect URI (this function's own URL without query params)
  const redirectUri = `${url.origin}${url.pathname}?provider=${provider}`;

  if (!provider || !['strava', 'whoop'].includes(provider)) {
    return htmlResponse(`
      <h2>One More &mdash; OAuth Setup</h2>
      <p>Choose a provider:</p>
      <ul>
        <li><a href="?provider=strava">Connect Strava</a></li>
        <li><a href="?provider=whoop">Connect WHOOP</a></li>
      </ul>
    `);
  }

  // ── Step 1: Redirect to provider authorization ──

  if (!code) {
    let authUrl;

    if (provider === 'strava') {
      authUrl = `https://www.strava.com/oauth/authorize?client_id=${process.env.STRAVA_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=activity:read_all&approval_prompt=auto`;
    } else {
      // WHOOP
      authUrl = `https://api.prod.whoop.com/oauth/oauth2/auth?client_id=${process.env.WHOOP_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=offline+read:recovery+read:sleep+read:profile`;
    }

    return new Response('', {
      status: 302,
      headers: { ...corsHeaders, Location: authUrl },
    });
  }

  // ── Step 2: Exchange code for tokens ──

  try {
    let tokenUrl, body, blobKey;

    if (provider === 'strava') {
      tokenUrl = 'https://www.strava.com/oauth/token';
      body = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        code,
      });
      blobKey = 'strava_refresh';
    } else {
      // WHOOP
      tokenUrl = 'https://api.prod.whoop.com/oauth/oauth2/token';
      body = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.WHOOP_CLIENT_ID,
        client_secret: process.env.WHOOP_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
      });
      blobKey = 'whoop_refresh';
    }

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!res.ok) {
      const text = await res.text();
      return htmlResponse(`
        <h2>One More &mdash; OAuth Error</h2>
        <p>Token exchange failed for ${provider} (${res.status}):</p>
        <pre>${text}</pre>
        <p><a href="?provider=${provider}">Try again</a></p>
      `, 400);
    }

    const data = await res.json();

    // Save refresh token to Blobs
    if (data.refresh_token) {
      await writeJSON(blobKey, data.refresh_token);
    }

    return htmlResponse(`
      <h2>One More &mdash; ${provider.charAt(0).toUpperCase() + provider.slice(1)} Connected</h2>
      <p>Refresh token saved. You can close this window.</p>
      <p>Access token expires in ${data.expires_in || '?'} seconds.</p>
      <p><small>Refresh token stored in Netlify Blobs key: <code>${blobKey}</code></small></p>
    `);
  } catch (err) {
    console.error(`auth.js ${provider} error:`, err);
    return htmlResponse(`
      <h2>One More &mdash; OAuth Error</h2>
      <p>Unexpected error: ${err.message}</p>
      <p><a href="?provider=${provider}">Try again</a></p>
    `, 500);
  }
}
