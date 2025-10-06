// /api/serp-search.ts

import type { VercelRequest, VercelResponse } from '@vercel/node';

const SERPER_API_URL = 'https://google.serper.dev/search';
const MAX_QUERY_LENGTH = 2048;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        res.status(405).json({ message: 'Method Not Allowed' });
        return;
    }

    let { query } = req.body;
    const apiKey = process.env.SERP_API_KEY;

    if (!apiKey) {
        res.status(500).json({ message: 'SERP API key not configured' });
        return;
    }
    if (!query || typeof query !== 'string') {
        res.status(400).json({ message: 'Query is required and must be a string' });
        return;
    }

    // --- START OF FIX ---
    if (query.length > MAX_QUERY_LENGTH) {
        console.warn(`[serp-search] Query truncated on server-side from ${query.length} to ${MAX_QUERY_LENGTH}.`);
        query = query.substring(0, MAX_QUERY_LENGTH);
    }
    // --- END OF FIX ---

    try {
        const response = await fetch(SERPER_API_URL, {
            method: 'POST',
            headers: {
                'X-API-KEY': apiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ q: query }), // Use the safe, truncated query
        });

        const data = await response.json();
        if (!response.ok) {
            console.error('[serp-search] Serper API returned an error:', data);
            res.status(response.status).json(data);
            return;
        }

        res.status(200).json(data);
        return;
    } catch (error: any) {
        console.error('[serp-search] An unexpected error occurred:', error);
        res.status(500).json({ message: 'An internal error occurred' });
        return;
    }
}
