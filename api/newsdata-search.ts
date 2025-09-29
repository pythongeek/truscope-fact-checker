import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query, fromDate, toDate, maxResults = 20 } = req.body;
  const NEWSDATA_API_KEY = process.env.NEWSDATA_API_KEY;

  if (!NEWSDATA_API_KEY) {
    return res.status(500).json({ error: 'NewsData API key not configured' });
  }

  try {
    const params = new URLSearchParams({
      apikey: NEWSDATA_API_KEY,
      q: query,
      language: 'en',
      country: 'us',
      size: Math.min(maxResults, 50).toString()
    });

    if (fromDate) params.append('from_date', fromDate);
    if (toDate) params.append('to_date', toDate);

    const response = await fetch(`https://newsdata.io/api/1/news?${params}`);

    if (!response.ok) {
      throw new Error(`NewsData API error: ${response.status}`);
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('NewsData API error:', error);
    return res.status(500).json({
      error: 'Failed to fetch news data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}