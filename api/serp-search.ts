import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query, num = 10 } = req.body;
  const SERP_API_KEY = process.env.SERP_API_KEY;

  if (!SERP_API_KEY) {
    return res.status(500).json({ error: 'SERP API key not configured' });
  }

  try {
    const params = new URLSearchParams({
      api_key: SERP_API_KEY,
      q: query,
      num: num.toString(),
      engine: 'google',
      gl: 'us',
      hl: 'en'
    });

    const response = await fetch(`https://serpapi.com/search.json?${params}`, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`SERP API error: ${response.status}`);
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('SERP API error:', error);
    return res.status(500).json({
      error: 'Failed to fetch search results',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}