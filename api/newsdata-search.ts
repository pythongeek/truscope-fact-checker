import type { VercelRequest, VercelResponse } from '@vercel/node';

// A simple fetch wrapper for Newsdata.io API
async function fetchNewsData(params: Record<string, any>, apiKey: string) {
    const query = new URLSearchParams(params).toString();
    const response = await fetch(`https://newsdata.io/api/1/news?apikey=${apiKey}&${query}`);

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Newsdata.io API responded with status ${response.status}: ${errorBody}`);
    }

    return response.json();
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const newsDataApiKey = process.env.NEWSDATA_API_KEY;

    // 💡 **Detailed Check 1: Validate the API Key**
    if (!newsDataApiKey) {
      throw new Error("FATAL: NEWSDATA_API_KEY is not configured in server environment variables.");
    }

    const params = req.body;
    console.log(`[Newsdata.io API] Initiating search with query: "${params.q}"`);

    const data = await fetchNewsData(params, newsDataApiKey);

    console.log(`[Newsdata.io API] Search successful.`);
    return res.status(200).json(data);

  } catch (error: unknown) {
    // 💡 **Detailed Check 2: Catch and Log ANY Error**
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";

    console.error("❌ [Newsdata.io API Handler Error]", {
      details: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return res.status(500).json({
      error: "Internal Server Error",
      message: "The news search request failed on the server. Check the function logs for details.",
      details: errorMessage,
    });
  }
}