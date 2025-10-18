import { VercelRequest, VercelResponse } from '@vercel/node';

// --- Configuration Constants ---
// Base URL for the NewsData.io API.
const NEWS_API_BASE_URL = 'https://newsdata.io/api/1/news';

// Default number of articles to fetch per request, keeping responses small.
const DEFAULT_PAGE_SIZE = 20;

// 30 days in milliseconds for calculating the default search window.
const THIRTY_DAYS_IN_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Helper function to get the date for 30 days ago in YYYY-MM-DD format.
 * This is used to default searches to the "recent content" window.
 */
const getThirtyDaysAgoDate = (): string => {
  const date = new Date(Date.now() - THIRTY_DAYS_IN_MS);
  return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD
};

/**
 * Vercel Serverless Function to handle news searches using the News API.
 * This acts as a secure backend proxy for your client-side requests.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    console.log('[news-search] Function invoked.');

    // --- Input Validation ---
    const { query, fromDate, pageSize } = req.body;

    if (!query || typeof query !== 'string') {
      console.error('[news-search] Error: Missing or invalid "query" parameter.');
      return res.status(400).json({ error: 'Bad Request: Missing required "query" parameter.' });
    }

    // --- API Key Validation ---
    const apiKey = process.env.NEWSAPI_API_KEY;
    if (!apiKey) {
      console.error('[news-search] FATAL: NEWSAPI_API_KEY environment variable not found!');
      return res.status(500).json({ error: 'Server Configuration Error: News API key not configured.' });
    }
    console.log('[news-search] API Key loaded successfully.');

    // --- API Parameter Construction ---
    const params = new URLSearchParams({
      apikey: apiKey,
      q: query,
      // Use a smaller, token-friendly page size by default.
      size: (pageSize || DEFAULT_PAGE_SIZE).toString(),
      // Focusing on English results is a safe default for consistency.
      language: 'en',
    });

    // --- Token Saving Strategy: Default to Recent Content ---
    // If the client provides a specific start date, we use it.
    // Otherwise, we default to the last 30 days to ensure we use the more
    // cost-effective "recent content" search tier.
    const searchFromDate = fromDate
      ? new Date(fromDate).toISOString().split('T')[0]
      : getThirtyDaysAgoDate();

    params.append('from_date', searchFromDate);
    console.log(`[news-search] Searching for content from: ${searchFromDate}`);

    // --- API Call ---
    const apiUrl = `${NEWS_API_BASE_URL}?${params.toString()}`;
    console.log(`[news-search] Fetching URL: ${apiUrl}`);

    const response = await fetch(apiUrl);

    console.log(`[news-search] Received status ${response.status} from News API.`);

    // --- Error Handling for API Response ---
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[news-search] News API Error: ${response.status}`, errorText);
      return res.status(response.status).json({
        message: 'Failed to fetch from the news API.',
        details: errorText,
      });
    }

    // --- Success Response ---
    const data = await response.json();
    console.log('[news-search] Successfully fetched data. Sending 200 OK response.');
    res.status(200).json(data);

  } catch (error: any) {
    // --- General Error Handling ---
    console.error('[news-search] An unexpected error occurred in the handler:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      details: error.message || 'An unknown error occurred.',
    });
  }
}
