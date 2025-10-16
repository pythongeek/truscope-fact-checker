// api/vertex.ts
import { VertexAI } from '@google-cloud/vertexai';
import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Initializes the Vertex AI client using service account credentials.
 * This function should only run on the server.
 */
const initializeVertexAI = () => {
  // These environment variables are configured in your Vercel project settings.
  const project = process.env.GCLOUD_PROJECT_ID;
  const location = process.env.GCLOUD_LOCATION;

  if (!project || !location) {
    throw new Error('Google Cloud project ID and location must be set in environment variables.');
  }
  // No need to pass credentials explicitly if the service account key JSON is set
  // via the GOOGLE_APPLICATION_CREDENTIALS_JSON env var (or GCLOUD_SERVICE_ACCOUNT_KEY_JSON).
  // The library will automatically pick it up.
  return new VertexAI({ project, location });
};

/**
 * Vercel Serverless Function to handle requests to Vertex AI.
 * This acts as a secure proxy, keeping all credentials server-side.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { prompt, options } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'A valid "prompt" string is required.' });
    }

    const vertexAI = initializeVertexAI();

    // Select the generative model
    const generativeModel = vertexAI.getGenerativeModel({
      model: options?.model || 'gemini-1.5-flash-001',
      generationConfig: {
        maxOutputTokens: options?.maxOutputTokens ?? 2048,
        temperature: options?.temperature ?? 0.3,
      },
    });

    const result = await generativeModel.generateContent(prompt);

    return res.status(200).json({ text });

  } catch (error: any) {
    console.error('Error calling Vertex AI API:', {
      message: error.message,
      stack: error.stack,
    });

    // Provide a generic error message to the client for security
    return res.status(500).json({ error: 'An internal server error occurred while contacting the AI model.' });
  }
}
