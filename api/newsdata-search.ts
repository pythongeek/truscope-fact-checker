// api/newsdata-search.ts
import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Wrap EVERYTHING in a try...catch block
  try {
    console.log('[newsdata-search] Function invoked.');

    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        console.error(`[newsdata-search] Error: Method ${req.method} Not Allowed.`);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    // 2. Log the incoming request body
    console.log(`[newsdata-search] Received body:`, req.body);
    const { query, lang, country } = req.body;

    if (!query) {
      console.error('[newsdata-search] Error: Missing "query" parameter in the request body.');
      return res.status(400).json({ error: 'Bad Request: Missing required query parameter "query".' });
    }

    // 3. Securely check and log the environment variable
    const apiKey = process.env.NEWSDATA_API_KEY;
    if (!apiKey) {
      console.error('[newsdata-search] FATAL: NEWSDATA_API_KEY environment variable not found!');
      return res.status(500).json({ error: 'Server Configuration Error: Newsdata API key not configured.' });
    } else {
      // Log a sanitized version to confirm it's loaded without exposing the full key
      console.log(`[newsdata-search] API Key loaded successfully. Starts with: ${apiKey.substring(0, 4)}...`);
    }

    // 4. Construct and log the URL before fetching
    const apiUrl = `https://newsdata.io/api/1/news?apikey=${apiKey}&q=${encodeURIComponent(
      query as string
    )}&language=${lang || 'en'}&country=${country || 'us'}`;
    // Log the URL with the API key redacted for security
    console.log(`[newsdata-search] Fetching URL: ${apiUrl.replace(apiKey, 'REDACTED')}`);

    const response = await fetch(apiUrl);

    // 5. Log the status of the external API response
    console.log(`[newsdata-search] Received status ${response.status} from Newsdata API.`);

    // 6. Check if the response is OK before parsing JSON
    if (!response.ok) {
      // Try to get text for better error logging, as it might not be JSON
      const errorText = await response.text();
      console.error('[newsdata-search] Newsdata API returned an error:', errorText);
      return res.status(response.status).json({
        error: 'Failed to fetch from Newsdata API',
        details: errorText
      });
    }

    // 7. Now it's safe to parse the JSON
    const data = await response.json();
    console.log('[newsdata-search] Successfully fetched data. Sending 200 OK response.');
    res.status(200).json(data);

  } catch (error: any) {
    // 8. This is the global catch. It will catch any other unexpected error.
    console.error('[newsdata-search] An unexpected error occurred in the handler:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      details: error.message || 'An unknown error occurred.'
    });
  }
}
