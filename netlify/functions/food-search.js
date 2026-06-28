// food-search.js — GET /food-search endpoint
// Proxies FatSecret food search for the client's food modal
// Returns { foods: [...] } with normalized results

import { fatsecretSearch, corsHeaders, corsResponse, checkToken } from './_lib.js';

export default async function handler(req) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: corsHeaders });
  }

  // Optional token gate
  const denied = checkToken(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const query = url.searchParams.get('q') || '';

  if (!query.trim()) {
    return corsResponse({ foods: [], error: 'Missing search query (q parameter)' });
  }

  try {
    const foods = await fatsecretSearch(query);
    return corsResponse({ foods });
  } catch (err) {
    console.error('food-search.js error:', err);
    return corsResponse({ foods: [], error: err.message });
  }
}
