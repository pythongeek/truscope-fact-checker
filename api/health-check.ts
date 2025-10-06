// api/health-check.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const apiStatus = {
    gemini: !!process.env.GEMINI_API_KEY,
    serp: !!process.env.SERP_API_KEY,
    webz: !!process.env.WEBZ_API_KEY,
    googleFactCheck: !!process.env.GOOGLE_FACT_CHECK_API_KEY
  };

  const allConfigured = Object.values(apiStatus).every(Boolean);

  return res.status(200).json({
    status: allConfigured ? 'healthy' : 'partial',
    timestamp: new Date().toISOString(),
    apis: apiStatus,
    message: allConfigured 
      ? 'All APIs configured' 
      : 'Some APIs missing configuration'
  });
}
