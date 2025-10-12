// api/index.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put, del } from '@vercel/blob';

// --- Main API Router ---
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { action } = req.body;

    // This file now only handles blob storage actions.
    // Other actions (e.g., 'fact-check') are handled by their own files in the /api directory.
    switch (action) {
      case 'blob-save-report':
        return await handleBlobSaveReport(req, res);
      case 'blob-delete-report':
        return await handleBlobDeleteReport(req, res);
      case 'blob-save-fact-database':
        return await handleBlobSaveFactDatabase(req, res);
      // Add other blob-related handlers here if necessary
      default:
        return res.status(400).json({ error: `Invalid action '${action}' for this endpoint.` });
    }
  } catch (error: any) {
    console.error('Unified Blob API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message,
    });
  }
}

// --- Blob Storage Handlers ---

async function handleBlobSaveReport(req: VercelRequest, res: VercelResponse) {
  try {
    const report = req.body;
    if (!report.id) {
        return res.status(400).json({ error: 'Report ID is missing.' });
    }
    const filename = `truescope-reports/${report.id}.json`;

    const blob = await put(filename, JSON.stringify(report), {
      access: 'public',
      addRandomSuffix: false, // Ensures a predictable URL
    });

    return res.status(200).json({ success: true, url: blob.url });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to save report', details: error.message });
  }
}

async function handleBlobDeleteReport(req: VercelRequest, res: VercelResponse) {
  try {
    const { reportId } = req.body;
    if (!reportId) {
        return res.status(400).json({ error: 'reportId is required.' });
    }
    // Note: The 'del' function takes a URL, not a filename. You'd typically get this URL from the 'put' response.
    // This is a placeholder; you'll need to adjust your logic to pass the full blob URL to be deleted.
    const blobUrlToDelete = `https://<YOUR_BLOB_STORE_URL>/truescope-reports/${reportId}.json`;
    await del(blobUrlToDelete);

    return res.status(200).json({ success: true, message: `Report ${reportId} deleted.` });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to delete report', details: error.message });
  }
}

async function handleBlobSaveFactDatabase(req: VercelRequest, res: VercelResponse) {
  try {
    const facts = req.body;
    const blob = await put('fact-database/db.json', JSON.stringify(facts, null, 2), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false, // This ensures the file is always overwritten at the same path
      // 'allowOverwrite' is deprecated and has been removed. 'addRandomSuffix: false' achieves the same goal.
    });

    return res.status(200).json({ success: true, url: blob.url });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to save database', details: error.message });
  }
}
