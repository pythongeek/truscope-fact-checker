import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getJson } from "serpapi";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Ensure we are only accepting POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const serpApiKey = process.env.SERP_API_KEY;

    // 💡 **Detailed Check 1: Validate the API Key**
    if (!serpApiKey) {
      // This throws a clear error that we will catch and log
      throw new Error("FATAL: SERP_API_KEY is not configured in server environment variables.");
    }

    const params = req.body;

    console.log(`[SERP API] Initiating search with query: "${params.q}"`);

    const response = await getJson({
      ...params,
      api_key: serpApiKey,
    });

    console.log(`[SERP API] Search successful for query: "${params.q}"`);
    return res.status(200).json(response);

  } catch (error: unknown) {
    // 💡 **Detailed Check 2: Catch and Log ANY Error**
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";

    // This is the crucial part for detailed debugging in Vercel
    console.error("❌ [SERP API Handler Error]", {
        details: errorMessage,
        // The stack trace is extremely useful for debugging
        stack: error instanceof Error ? error.stack : undefined,
    });

    // Send a standardized error response to the frontend
    return res.status(500).json({
      error: "Internal Server Error",
      message: "The search request failed on the server. Check the function logs for details.",
      details: errorMessage, // Optionally send the error message back
    });
  }
}