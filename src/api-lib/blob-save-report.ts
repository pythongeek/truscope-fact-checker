
import { put } from '@vercel/blob';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const report = req.body;
    const filename = `truescope-reports/${report.id}.json`;

    const blob = await put(filename, JSON.stringify(report), {
      access: 'public',
      addRandomSuffix: false,
    });

    return res.status(200).json({ success: true, url: blob.url });
  } catch (error) {
    console.error('Failed to save report to blob storage:', error);
    return res.status(500).json({ error: 'Failed to save report' });
  }
}
