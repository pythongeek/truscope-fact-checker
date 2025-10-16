// api/auto-correct.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
// FIX: The import is an object, not a class. Corrected the name to match the export.
import { vertexAiService } from '../src/services/vertexAiService';
import { logger } from '../src/utils/logger';

/**
 * NOTE: This entire API route is now considered DEPRECATED.
 * Its functionality is superseded by the more generic and secure `api/vertex.ts` route.
 * The client-side logic should be refactored to call `vertexAiService.generateText()` directly,
 * which will handle routing the request to the correct, centralized backend endpoint.
 * This file is corrected to pass the build but should be removed afterward.
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { text, mode } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'A valid "text" string is required.' });
    }

    // This endpoint now acts as a simple pass-through to the client-side service,
    // which in turn calls the actual secure backend at `/api/vertex`.
    // This architecture is inefficient, which is why we will remove this file.

    // 1. Create a powerful and specific prompt for the AI
    const systemInstruction = `You are an expert editor. Your task is to meticulously review the provided text and correct any issues. You must return a JSON object with the single key "correctedText", which contains the fully corrected version of the text.

Focus on:
- Fixing all spelling mistakes and grammatical errors.
- Improving clarity, flow, and readability.
- Ensuring a professional and polished tone.
- Do NOT add any extra commentary or explanation outside of the JSON structure.

Analyze the following text:
"""
${text}
"""`;

    // 2. Call the Vertex AI service to get the correction.
    // FIX: The `generateText` function now takes a single prompt string and an optional options object.
    const responseJsonString = await vertexAiService.generateText(systemInstruction);

    // 3. Parse the JSON response from the AI
    let correctedText: string;
    try {
      const parsedResponse = JSON.parse(responseJsonString);
      correctedText = parsedResponse.correctedText;
      if (typeof correctedText !== 'string') {
        throw new Error('Invalid format: "correctedText" key not found or not a string.');
      }
    } catch (parseError) {
      logger.warn('Failed to parse JSON response from Vertex AI; using raw response as fallback.', {
        rawResponse: responseJsonString,
      });
      // Fallback: If the model fails to return valid JSON, use the raw response.
      correctedText = responseJsonString.trim();
    }

    // 4. Send the successful response back to the frontend
    return res.status(200).json({
      editedText: correctedText,
      changesApplied: [],
      summary: `Auto-correction applied in ${mode || 'standard'} mode.`,
    });

  } catch (error: any) {
    logger.error('Error in auto-correct handler:', {
      message: error.message,
    });
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
}
