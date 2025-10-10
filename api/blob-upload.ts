
import { put } from '@vercel/blob';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { filePath, data } = req.body;
    if (!filePath || !data) {
      return res.status(400).json({ error: 'filePath and data are required' });
    }

    const blob = await put(filePath, JSON.stringify(data), {
      access: 'public',
      addRandomSuffix: false,
    });

    return res.status(200).json({ success: true, url: blob.url });
  } catch (error) {
    console.error('Failed to upload to blob storage:', error);
    return res.status(500).json({ error: 'Failed to upload file' });
  }
}
