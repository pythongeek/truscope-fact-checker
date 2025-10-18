// api/news-search.ts - ENHANCED WRAPPER WITH BETTER ERROR HANDLING
import type { VercelRequest, VercelResponse } from '@vercel/node';
import coreNewsHandler from '../src/api-lib/news-search';

// Vercel serverless function configuration
export const config = {
  maxDuration: 10, // 10 seconds timeout for Hobby tier
};

/**
 * Public-facing Vercel serverless function for news searches.
 * Handles CORS, method validation, and delegates to the optimized core handler.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();
  
  // --- CORS Headers ---
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*'); // TODO: Restrict to your domain in production
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // --- Handle Preflight OPTIONS Request ---
  if (req.method === 'OPTIONS') {
    console.log('[news-search-wrapper] ✅ Preflight request handled');
    return res.status(200).end();
  }

  // --- Method Validation ---
  if (req.method !== 'POST') {
    console.warn(`[news-search-wrapper] ⚠️ Invalid method: ${req.method}`);
    return res.status(405).json({
      error: 'Method Not Allowed',
      message: 'This endpoint only accepts POST requests',
      allowedMethods: ['POST', 'OPTIONS'],
    });
  }

  try {
    console.log('[news-search-wrapper] 🚀 Delegating to core handler...');
    
    // Delegate to the optimized core handler
    await coreNewsHandler(req, res);
    
    const processingTime = Date.now() - startTime;
    console.log(`[news-search-wrapper] ✅ Request completed in ${processingTime}ms`);
    
  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error('[news-search-wrapper] ❌ Wrapper error:', error);
    
    // Only send error response if headers haven't been sent yet
    if (!res.headersSent) {
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred in the news search wrapper',
        details: error.message,
        processingTime: `${processingTime}ms`,
      });
    }
  }
}
