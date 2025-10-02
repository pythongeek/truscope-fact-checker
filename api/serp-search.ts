// api/serp-search.ts
import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Wrap EVERYTHING in a try...catch block
  try {
    console.log('[serp-search] Function invoked.');

    // Enable CORS for debugging
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight requests for CORS
    if (req.method === 'OPTIONS') {
      console.log('[serp-search] Responding to OPTIONS preflight request.');
      return res.status(200).end();
    }

    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        console.error(`[serp-search] Error: Method ${req.method} Not Allowed.`);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    // 2. Log the incoming request body
    console.log(`[serp-search] Received body:`, req.body);
    const { query, engine } = req.body;

    if (!query) {
      console.error('[serp-search] Error: Missing "query" parameter in the request body.');
      return res.status(400).json({ error: 'Bad Request: Missing required query parameter "query".' });
    }

    // 3. Securely check and log the environment variable
    const apiKey = process.env.SERP_API_KEY;
    if (!apiKey) {
      console.error('[serp-search] FATAL: SERP_API_KEY environment variable not found!');
      return res.status(500).json({ error: 'Server Configuration Error: SERP API key not configured.' });
    } else {
      // Log a sanitized version to confirm it's loaded without exposing the full key
      console.log(`[serp-search] API Key loaded successfully. Starts with: ${apiKey.substring(0, 4)}...`);
    }

    // 4. Construct and log the URL before fetching
    const searchParams = new URLSearchParams({
        ...req.body,
        api_key: apiKey,
        q: query as string,
        engine: (engine as string) || 'google',
      });

    const apiUrl = `https://serpapi.com/search.json?${searchParams.toString()}`;
    // Log URL without the API key for security
    console.log(`[serp-search] Fetching URL: ${apiUrl.replace(apiKey, 'REDACTED')}`);

    const response = await fetch(apiUrl);

    // 5. Log the status of the external API response
    console.log(`[serp-search] Received status ${response.status} from SERP API.`);

    // 6. Check if the response is OK before parsing JSON
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[serp-search] SERP API returned an error:', errorText);
      return res.status(response.status).json({
        error: 'Failed to fetch from SERP API',
        details: errorText
      });
    }

    // 7. Now it's safe to parse the JSON
    const responseData = await response.json();

    // Also check for logical errors returned in a 200 OK response
    if (responseData.error) {
        console.error('[serp-search] SERP API returned a logical error:', responseData.error);
        return res.status(400).json({
            error: 'SERP API returned an error',
            details: responseData.error,
        });
    }

    console.log('[serp-search] Successfully fetched data. Sending 200 OK response.');
    res.status(200).json(responseData);

  } catch (error: any) {
    // 8. This is the global catch. It will catch any other unexpected error.
    console.error('[serp-search] An unexpected error occurred in the handler:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      details: error.message || 'An unknown error occurred.'
    });
  }
}
