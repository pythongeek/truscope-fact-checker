import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    console.log('[serp-search] Function invoked.');

    const { query } = req.body;
    if (!query) {
      console.error('[serp-search] Error: Missing "query" parameter in the request body.');
      return res.status(400).json({ error: 'Bad Request: Missing required "query" parameter.' });
    }

    const apiKey = process.env.SERP_API_KEY;
    if (!apiKey) {
      console.error('[serp-search] FATAL: SERP_API_KEY environment variable not found!');
      return res.status(500).json({ error: 'Server Configuration Error: SERP API key not configured.' });
    } else {
      console.log(`[serp-search] API Key loaded successfully.`);
    }

    const apiUrl = 'https://google.serper.dev/search';
    console.log(`[serp-search] Fetching from URL: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query }),
    });

    console.log(`[serp-search] Received status ${response.status} from Serper API.`);

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[serp-search] Serper API returned an error:', errorData);
      return res.status(response.status).json({
        error: 'Failed to fetch from Serper API',
        details: errorData,
      });
    }

    const data = await response.json();
    console.log('[serp-search] Successfully fetched data. Sending 200 OK response.');
    res.status(200).json(data);

  } catch (error: any) {
    console.error('[serp-search] An unexpected error occurred in the handler:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      details: error.message || 'An unknown error occurred.',
    });
  }
}
