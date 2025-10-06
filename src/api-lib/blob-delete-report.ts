
import { del } from '@vercel/blob';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { reportId } = req.body;
    const filename = `truescope-reports/${reportId}.json`;

    await del(filename);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Failed to delete report from blob storage:', error);
    return res.status(500).json({ error: 'Failed to delete report' });
  }
}
