import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[health-check] Function invoked successfully.');
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
}
