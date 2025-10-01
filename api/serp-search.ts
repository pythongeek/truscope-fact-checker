import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Enable CORS for debugging
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      error: 'Method not allowed',
      message: `Method ${req.method} Not Allowed`
    });
  }

  try {
    const serpApiKey = process.env.SERP_API_KEY;

    // Validate API key
    if (!serpApiKey) {
      console.error('❌ SERP_API_KEY environment variable is not set');
      return res.status(500).json({
        error: 'Configuration Error',
        message: 'SERP_API_KEY is not configured on the server',
        details: 'Please add SERP_API_KEY to your Vercel environment variables'
      });
    }

    // Validate request body
    if (!req.body || typeof req.body !== 'object') {
      console.error('❌ Invalid request body:', req.body);
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Request body must be a valid JSON object',
        received: typeof req.body
      });
    }

    const params = req.body;

    // Ensure required parameters
    if (!params.q && !params.engine) {
      console.error('❌ Missing required parameters:', params);
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required parameters: q (query) or engine',
        received: params
      });
    }

    console.log(`[SERP API] Initiating search with query: "${params.q}"`);
    console.log('[SERP API] Full params:', JSON.stringify(params, null, 2));

    // Use native fetch instead of serpapi library to avoid dependencies issues
    const searchParams = new URLSearchParams({
      api_key: serpApiKey,
      engine: params.engine || 'google',
      q: params.q || '',
      ...params
    });

    const serpApiUrl = `https://serpapi.com/search.json?${searchParams.toString()}`;

    console.log('[SERP API] Request URL (without key):', serpApiUrl.replace(serpApiKey, 'REDACTED'));

    const response = await fetch(serpApiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ SERP API responded with status ${response.status}:`, errorText);

      return res.status(response.status).json({
        error: 'SERP API Error',
        message: `SERP API returned status ${response.status}`,
        details: errorText,
        statusCode: response.status
      });
    }

    const data = await response.json();

    // Check for API-level errors in the response
    if (data.error) {
      console.error('❌ SERP API returned error:', data.error);
      return res.status(400).json({
        error: 'SERP API Error',
        message: data.error,
        details: data
      });
    }

    console.log(`✅ [SERP API] Search successful for query: "${params.q}"`);
    console.log(`[SERP API] Results count:`, data.organic_results?.length || 0);

    return res.status(200).json(data);

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error("❌ [SERP API Handler Error]", {
      message: errorMessage,
      stack: errorStack,
      error: error
    });

    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'The SERP search request failed on the server',
      details: errorMessage,
      timestamp: new Date().toISOString()
    });
  }
}