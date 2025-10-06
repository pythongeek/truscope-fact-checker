// api/webz-news-search.ts - COMPLETE VERSION
import type { VercelRequest, VercelResponse } from '@vercel/node';

const WEBZ_API_URL = 'https://api.webz.io/newsApiLite';

interface WebzNewsRequest {
  query: string;
  fromDate?: string;
}

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

  const { query, fromDate }: WebzNewsRequest = req.body;
  const apiKey = process.env.WEBZ_API_KEY;

  if (!apiKey) {
    console.error('[webz-news] WEBZ_API_KEY not configured');
    return res.status(500).json({ error: 'Webz API key not configured' });
  }

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query is required and must be a string' });
  }

  console.log(`[webz-news] Searching news for: "${query}"`);

  try {
    // Build query parameters
    const params = new URLSearchParams({
      token: apiKey,
      q: query,
      size: '10',
      sort: 'relevancy'
    });

    if (fromDate) {
      params.append('ts', fromDate);
    }

    const url = `${WEBZ_API_URL}?${params.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[webz-news] Webz API error:', data);
      return res.status(response.status).json({
        error: 'Webz API error',
        details: data
      });
    }

    console.log(`[webz-news] Found ${data.posts?.length || 0} articles`);
    return res.status(200).json(data);

  } catch (error: any) {
    console.error('[webz-news] Unexpected error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}
