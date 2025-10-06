
import { put } from '@vercel/blob';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id, results, originalText, factCheckId, timestamp } = req.body;

    const batchData = {
      id,
      timestamp,
      type: 'batch-results',
      factCheckId,
      originalText,
      results,
      metadata: {
        totalModes: results.length,
        version: '1.0',
        platform: 'truescope-ai',
        batchProcessingTime: results.reduce((sum: number, r: any) => sum + r.processingTime, 0)
      }
    };

    // Save batch summary
    const batchFilename = `batch-results/${factCheckId}/${id}.json`;
    const batchBlob = await put(batchFilename, JSON.stringify(batchData, null, 2), {
      access: 'public',
      contentType: 'application/json'
    });

    // Save individual results
    const individualUrls = await Promise.all(
      results.map(async (result: any, index: number) => {
        const filename = `editor-results/${factCheckId}/${result.mode}/${id}_${index}.json`;
        const blob = await put(filename, JSON.stringify({
          ...result,
          batchId: id,
          factCheckId,
          timestamp
        }, null, 2), {
          access: 'public',
          contentType: 'application/json'
        });
        return { mode: result.mode, url: blob.url };
      })
    );

    return res.status(200).json({
      success: true,
      batchUrl: batchBlob.url,
      urls: individualUrls,
      totalResults: results.length
    });
  } catch (error) {
    console.error('Batch blob save error:', error);
    return res.status(500).json({ error: 'Failed to save batch results' });
  }
}
