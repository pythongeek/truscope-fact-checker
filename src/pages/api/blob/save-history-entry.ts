// src/pages/api/blob/save-history-entry.ts
import { put } from '@vercel/blob';
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const entry = req.body;

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error('BLOB_READ_WRITE_TOKEN is not configured');
    }

    const filename = `history-entries/${entry.id}.json`;
    const blob = await put(filename, JSON.stringify(entry, null, 2), {
      access: 'public',
      contentType: 'application/json',
      token: process.env.BLOB_READ_WRITE_TOKEN
    });

    res.status(200).json({
      success: true,
      url: blob.url,
      id: entry.id
    });
  } catch (error) {
    console.error('History save error:', error);
    res.status(500).json({
      error: `Failed to save history entry: ${error.message}`
    });
  }
}