// api/serp-search.ts - COMPLETE VERSION
import type { VercelRequest, VercelResponse } from '@vercel/node';

const SERPER_API_URL = 'https://google.serper.dev/search';
const MAX_QUERY_LENGTH = 2048;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  let { query } = req.body;
  const apiKey = process.env.SERP_API_KEY;

  if (!apiKey) {
    console.error('[serp-search] SERP_API_KEY not configured');
    return res.status(500).json({ error: 'SERP API key not configured' });
  }

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query is required and must be a string' });
  }

  // Truncate query if too long
  if (query.length > MAX_QUERY_LENGTH) {
    console.warn(`[serp-search] Query truncated from ${query.length} to ${MAX_QUERY_LENGTH}`);
    query = query.substring(0, MAX_QUERY_LENGTH);
  }

  console.log(`[serp-search] Searching for: "${query.substring(0, 100)}..."`);

  try {
    const response = await fetch(SERPER_API_URL, {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[serp-search] Serper API error:', data);
      return res.status(response.status).json({ 
        error: 'Serper API error',
        details: data 
      });
    }

    console.log(`[serp-search] Found ${data.organic?.length || 0} results`);
    return res.status(200).json(data);

  } catch (error: any) {
    console.error('[serp-search] Unexpected error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}
