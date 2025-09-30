// api/serp-search.ts

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getJson } from 'serpapi';
import { normalizeSerpResponse } from '../src/services/evidenceNormalizer';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Only POST requests allowed' });
  }

  const { query } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'Query parameter is required' });
  }

  try {
    const apiKey = process.env.SERP_API_KEY;
    if (!apiKey) {
        throw new Error("SERP API key is not configured.");
    }

    const response = await getJson({
      api_key: apiKey,
      q: query,
      engine: 'google',
      gl: 'us',
      hl: 'en',
    });

    const normalizedEvidence = normalizeSerpResponse(response);

    res.status(200).json({ evidence: normalizedEvidence });

  } catch (error: any) {
    console.error('SERP API Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch search results from SERP API.', details: error.message });
  }
}
