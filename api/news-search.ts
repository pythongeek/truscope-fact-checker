// api/news-search.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
// --- FIX: Corrected the import path from '../../src/...' to '../src/...' ---
import coreNewsHandler from '../src/api-lib/news-search';

/**
 * This is the public-facing Vercel serverless function for news searches.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set essential CORS headers to allow the frontend to call this API
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*'); // Or specify your frontend domain
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle the browser's pre-flight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Delegate the actual work to the core handler
  return coreNewsHandler(req, res);
}
