// api/news-search.ts

import type { VercelRequest, VercelResponse } from '@vercel/node';
// Import the core business logic from our refactored handler
import coreNewsHandler from '../../src/api-lib/news-search';

/**
 * This is the public-facing Vercel serverless function for news searches.
 *
 * Its responsibilities include:
 * 1. Setting Cross-Origin Resource Sharing (CORS) headers to allow the
 * React frontend to securely communicate with this endpoint.
 * 2. Handling pre-flight 'OPTIONS' requests sent by browsers.
 * 3. Delegating the actual request processing to our core logic handler
 * located in the `src/api-lib` directory.
 *
 * This structure keeps our API route clean and separates concerns effectively.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // --- Step 1: Set CORS Headers ---
  // These headers are essential for allowing your deployed React app
  // to make requests to this API endpoint.
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*'); // Or specify your domain for better security
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // --- Step 2: Handle Pre-flight OPTIONS Request ---
  // Browsers send an OPTIONS request first to ensure the server allows the actual request.
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // --- Step 3: Delegate to the Core Logic Handler ---
  // For any other request (e.g., POST), pass it to the actual handler
  // which contains the logic to call the News API.
  return coreNewsHandler(req, res);
}
