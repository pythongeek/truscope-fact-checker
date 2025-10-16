// api/auto-correct.ts

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { VertexAIService } from '../src/services/vertexAiService'; // Adjusted path to src
import { logger } from '../src/utils/logger'; // Adjusted path to src

// These values MUST be set in your Vercel project's Environment Variables settings.
const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID;
const GCP_LOCATION = process.env.GCP_LOCATION; // e.g., 'us-central1'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { text, mode } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'The "text" field is required.' });
    }

    // 1. Securely extract the user's API key from the Authorization header.
    // The frontend must send this in the format: `Bearer <USER_API_KEY>`
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Bearer token is missing or invalid.' });
    }
    const userApiKey = authHeader.split(' ')[1];

    // 2. Validate server configuration
    if (!GCP_PROJECT_ID || !GCP_LOCATION) {
      logger.error('Server configuration error: GCP_PROJECT_ID or GCP_LOCATION is not set.');
      return res.status(500).json({ error: 'Internal Server Error: Application is not configured correctly.' });
    }

    // 3. Instantiate the VertexAI service with the user's key and server config
    const vertexAI = new VertexAIService({
      apiKey: userApiKey,
      projectId: GCP_PROJECT_ID,
      location: GCP_LOCATION,
      model: 'gemini-1.5-flash-001', // Specifying the model for this task
    });

    // 4. Create a powerful and specific prompt for the AI
    const systemInstruction = `You are an expert editor. Your task is to meticulously review the provided text and correct any issues. You must return a JSON object with the single key "correctedText", which contains the fully corrected version of the text.

Focus on:
- Fixing all spelling mistakes and grammatical errors.
- Improving clarity, flow, and readability.
- Ensuring a professional and polished tone.
- Do NOT add any extra commentary or explanation outside of the JSON structure.

Analyze the following text:`;

    // 5. Call the Vertex AI service to get the correction
    const responseJsonString = await vertexAI.generateText(text, systemInstruction);

    // 6. Parse the JSON response from the AI
    let correctedText: string;
    try {
      const parsedResponse = JSON.parse(responseJsonString);
      correctedText = parsedResponse.correctedText;
      if (typeof correctedText !== 'string') {
        throw new Error('Invalid format: "correctedText" key not found or not a string.');
      }
    } catch (parseError) {
      logger.error('Failed to parse JSON response from Vertex AI', {
        rawResponse: responseJsonString,
        error: parseError,
      });
      // Fallback: If the model fails to return valid JSON, use the raw response.
      correctedText = responseJsonString;
    }

    // 7. Send the successful response back to the frontend
    return res.status(200).json({
      editedText: correctedText,
      // The 'changesApplied' and 'summary' fields can be generated in a more advanced version.
      // For now, we focus on delivering the core corrected text.
      changesApplied: [], 
      summary: `Auto-correction applied in ${mode || 'standard'} mode.`,
    });

  } catch (error: any) {
    logger.error('Error in auto-correct handler:', {
      message: error.message,
      stack: error.stack,
      // Avoid logging the entire request in production for privacy reasons
    });

    // Provide a generic error to the client for security
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
}
