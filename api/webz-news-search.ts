import { VercelRequest, VercelResponse } from '@vercel/node';

const MAX_WEBZ_QUERY_LENGTH = 100; // Define the hard limit

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    console.log('[webz-news-search] Function invoked.');

    let { query, fromDate } = req.body; // Make query mutable
    if (!query) {
      console.error('[webz-news-search] Error: Missing "query" parameter in the request body.');
      return res.status(400).json({ error: 'Bad Request: Missing required "query" parameter.' });
    }

    // --- START OF FIX ---
    // Add a server-side safeguard to truncate the query if it's too long
    if (query.length > MAX_WEBZ_QUERY_LENGTH) {
      console.warn(`[webz-news-search] Query was truncated on server from ${query.length} to ${MAX_WEBZ_QUERY_LENGTH} characters.`);
      query = query.substring(0, MAX_WEBZ_QUERY_LENGTH);
    }
    // --- END OF FIX ---

    const apiKey = process.env.WEBZ_API_KEY;
    if (!apiKey) {
      console.error('[webz-news-search] FATAL: WEBZ_API_KEY environment variable not found!');
      return res.status(500).json({ error: 'Server Configuration Error: Webz.io API key not configured.' });
    } else {
      console.log(`[webz-news-search] API Key loaded successfully.`);
    }

    // Webz.io API endpoint
    const baseUrl = 'https://api.webz.io/newsApiLite';

    // Construct search parameters
    const params = new URLSearchParams({
      token: apiKey,
      q: query as string,
    });

    // Add timestamp if fromDate is provided, for searching recent news
    if (fromDate) {
        const fromTimestamp = Math.floor(new Date(fromDate).getTime() / 1000);
        params.append('ts', fromTimestamp.toString());
    }

    const apiUrl = `${baseUrl}?${params.toString()}`;
    console.log(`[webz-news-search] Fetching URL: ${apiUrl}`);

    const response = await fetch(apiUrl);

    console.log(`[webz-news-search] Received status ${response.status} from Webz.io API.`);

    if (!response.ok) {
      // If not, read the response as plain text to avoid a JSON parsing error
      const errorText = await response.text();
      console.error(`[webz-news-search] Webz.io API Error: ${response.status}`, errorText);

      // Return a structured error to your frontend
      return res.status(500).json({
        message: 'Failed to fetch from the news API.',
        details: errorText
      });
    }

    const data = await response.json();
    console.log('[webz-news-search] Successfully fetched data. Sending 200 OK response.');
    res.status(200).json(data);

  } catch (error: any) {
    console.error('[webz-news-search] An unexpected error occurred in the handler:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      details: error.message || 'An unknown error occurred.',
    });
  }
}
