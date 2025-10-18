// api/vertex.ts
import { VertexAI } from '@google-cloud/vertexai';
import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Initializes the Vertex AI client using service account credentials.
 * This function properly decodes the base64-encoded service account key
 * and configures authentication for Vercel deployment.
 */
const initializeVertexAI = () => {
  const project = process.env.GCLOUD_PROJECT_ID;
  const location = process.env.GCLOUD_LOCATION;
  const base64Credentials = process.env.GCLOUD_SERVICE_ACCOUNT_KEY_JSON;

  if (!project || !location) {
    throw new Error('GCLOUD_PROJECT_ID and GCLOUD_LOCATION must be set in environment variables.');
  }

  if (!base64Credentials) {
    throw new Error('GCLOUD_SERVICE_ACCOUNT_KEY_JSON must be set in environment variables.');
  }

  try {
    // Decode the base64-encoded service account key
    const credentialsJson = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const credentials = JSON.parse(credentialsJson);

    // Set the credentials as an environment variable for the Google Auth library
    // This is the proper way to authenticate in serverless environments
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = credentialsJson;

    console.log('✅ Vertex AI credentials loaded successfully');
    console.log(`📍 Project: ${project}, Location: ${location}`);

    // Initialize VertexAI with explicit credentials
    return new VertexAI({
      project,
      location,
      googleAuthOptions: {
        credentials: {
          client_email: credentials.client_email,
          private_key: credentials.private_key,
        },
      },
    });
  } catch (error: any) {
    console.error('❌ Failed to parse service account credentials:', error.message);
    throw new Error('Invalid GCLOUD_SERVICE_ACCOUNT_KEY_JSON format. Ensure it is base64-encoded JSON.');
  }
};

/**
 * Vercel Serverless Function to handle requests to Vertex AI.
 * This acts as a secure proxy, keeping all credentials server-side.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers for frontend access
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const startTime = Date.now();

  try {
    const { prompt, options } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'A valid "prompt" string is required.' });
    }

    console.log(`🤖 Vertex AI request received (prompt length: ${prompt.length} chars)`);

    const vertexAI = initializeVertexAI();

    // Select the generative model
    const modelName = options?.model || 'gemini-1.5-flash-001';
    const generativeModel = vertexAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        maxOutputTokens: options?.maxOutputTokens ?? 8192,
        temperature: options?.temperature ?? 0.3,
        topP: options?.topP ?? 0.95,
        topK: options?.topK ?? 40,
      },
    });

    console.log(`📡 Calling Vertex AI with model: ${modelName}`);

    // Generate content with timeout protection
    const result = await Promise.race([
      generativeModel.generateContent(prompt),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Vertex AI request timed out after 25 seconds')), 25000)
      ),
    ]) as any;

    // Extract the text from the response
    const response = result.response;
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      console.error('❌ Vertex AI response was empty or malformed:', JSON.stringify(response, null, 2));
      return res.status(500).json({ 
        error: 'The AI model returned an empty response.',
        details: 'No text content found in response candidates'
      });
    }

    const processingTime = Date.now() - startTime;
    console.log(`✅ Vertex AI response generated successfully (${processingTime}ms, ${text.length} chars)`);

    return res.status(200).json({ 
      text,
      metadata: {
        model: modelName,
        processingTimeMs: processingTime,
        responseLength: text.length
      }
    });

  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    
    console.error('❌ Error calling Vertex AI API:', {
      message: error.message,
      stack: error.stack,
      processingTime: `${processingTime}ms`,
    });

    // Provide detailed error information for debugging while keeping it secure
    const errorMessage = error.message?.includes('authenticate') 
      ? 'Authentication failed. Please check your Google Cloud service account credentials.'
      : error.message?.includes('quota')
      ? 'API quota exceeded. Please check your Google Cloud billing and quotas.'
      : error.message?.includes('timeout')
      ? 'Request timed out. The AI model took too long to respond.'
      : 'An internal server error occurred while contacting the AI model.';

    return res.status(500).json({ 
      error: errorMessage,
      code: error.code || 'INTERNAL_ERROR',
      processingTime: `${processingTime}ms`
    });
  }
}
