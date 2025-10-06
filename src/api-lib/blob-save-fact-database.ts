
import { put } from '@vercel/blob';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Debugging: Check if the environment variable is available
    console.log(
      'BLOB_READ_WRITE_TOKEN is set:',
      !!process.env.BLOB_READ_WRITE_TOKEN
    );

    const facts = req.body;
    console.log('Received facts to save:', JSON.stringify(facts, null, 2));

    const dbPath = 'fact-database/db.json';

    const blob = await put(dbPath, JSON.stringify(facts, null, 2), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true,
    });

    console.log('Successfully saved fact database. Blob URL:', blob.url);

    return res.status(200).json({ success: true, url: blob.url });
  } catch (error: any) {
    console.error('Failed to save fact database:', error);
    return res.status(500).json(
      { error: 'Failed to save fact database', details: error.message }
    );
  }
}
