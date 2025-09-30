// api/newsdata-search.ts

import { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';
import { normalizeNewsDataResponse } from '../src/services/evidenceNormalizer';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Only POST requests allowed' });
  }

  const { query } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'Query parameter is required' });
  }

  const apiKey = process.env.NEWSDATA_IO_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'NewsData.io API key is not configured.'});
  }

  const url = `https://newsdata.io/api/1/news?apikey=${apiKey}&q=${encodeURIComponent(query)}&language=en`;

  try {
    const apiResponse = await fetch(url);
    if (!apiResponse.ok) {
        const errorBody = await apiResponse.text();
        throw new Error(`API request failed with status ${apiResponse.status}: ${errorBody}`);
    }

    const data = await apiResponse.json();
    const normalizedEvidence = normalizeNewsDataResponse(data);

    res.status(200).json({ evidence: normalizedEvidence });

  } catch (error: any) {
    console.error('NewsData.io API Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch news articles from NewsData.io.', details: error.message });
  }
}
