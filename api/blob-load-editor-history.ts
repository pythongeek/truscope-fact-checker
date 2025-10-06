import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { factCheckId, mode } = req.query;

    if (!factCheckId) {
      return res.status(400).json({ error: 'factCheckId is required' });
    }

    const mockHistory = {
      factCheckId,
      results: []
    };

    return res.status(200).json(mockHistory);
  } catch (error: any) {
    console.error('Load history error:', error);
    return res.status(500).json({ error: 'Failed to load editor history', details: error.message });
  }
}
