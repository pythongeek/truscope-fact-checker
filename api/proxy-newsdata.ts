// api/proxy-newsdata.ts (Vercel Serverless Function)
// You will need a simple HTTP library like 'axios' or 'node-fetch' installed on your Vercel environment.

import { VercelRequest, VercelResponse } from '@vercel/node';
// import axios from 'axios'; // Import your chosen HTTP client

export default async (req: VercelRequest, res: VercelResponse) => {
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    try {
        const { apiKey, params } = req.body;

        if (!apiKey || !params) {
            return res.status(400).json({ error: 'Missing API key or parameters in request body.' });
        }

        const NEWS_DATA_BASE_URL = 'https://newsdata.io/api/1/news';

        // Build query parameters, ensuring the user's front-facing key is used
        const queryParams = new URLSearchParams({
            ...params,
            apikey: apiKey,
        }).toString();

        const fullUrl = `${NEWS_DATA_BASE_URL}?${queryParams}`;

        // Example with fetch (assuming Node environment on Vercel)
        const proxyResponse = await fetch(fullUrl);
        const data = await proxyResponse.json();

        if (!proxyResponse.ok) {
            return res.status(proxyResponse.status).json({
                error: 'External API Call Failed',
                details: data,
                api: 'newsdata.io'
            });
        }

        return res.status(200).json(data);

    } catch (error: any) {
        console.error('Vercel NewsData.io Proxy Error:', error.message);
        return res.status(500).json({
            error: 'Internal Proxy Error',
            details: error.message,
            api: 'newsdata.io'
        });
    }
};