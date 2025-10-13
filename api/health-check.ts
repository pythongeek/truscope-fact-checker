// api/health-check.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers for broad compatibility
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Check for server-side API keys ONLY
    const apiStatus = {
      serp: !!process.env.SERP_API_KEY,
      webz: !!process.env.WEBZ_API_KEY,
    };

    const allConfigured = Object.values(apiStatus).every(Boolean);

    return res.status(200).json({
      status: allConfigured ? 'healthy' : 'partial',
      timestamp: new Date().toISOString(),
      apis: apiStatus,
      message: allConfigured
        ? 'All server-side APIs configured'
        : 'Some server-side APIs are missing configuration',
    });
  } catch (error) {
    // Log the error for debugging on the Vercel platform
    console.error('Error in health-check endpoint:', error);
    
    // Return a structured error response
    return res.status(500).json({
      status: 'error',
      message: 'An internal server error occurred.',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
