
import { list } from '@vercel/blob';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prefix } = req.body;
    if (typeof prefix !== 'string') {
      return res.status(400).json({ error: 'prefix string is required' });
    }

    const { blobs } = await list({ prefix });
    const paths = blobs.map(blob => blob.pathname);

    return res.status(200).json({ success: true, paths });
  } catch (error) {
    console.error('Failed to list from blob storage:', error);
    return res.status(500).json({ error: 'Failed to list files' });
  }
}
