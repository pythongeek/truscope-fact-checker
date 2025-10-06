
import { del } from '@vercel/blob';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { reportId } = req.body;
    const filename = `truescope-reports/${reportId}.json`;

    await del(filename);

    res.status(200).json({ success: true });
    return;
  } catch (error) {
    console.error('Failed to delete report from blob storage:', error);
    res.status(500).json({ error: 'Failed to delete report' });
    return;
  }
}
