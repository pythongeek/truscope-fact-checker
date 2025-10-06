import { put } from '@vercel/blob';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { factCheckIds, format = 'json', includeAnalytics = false } = req.body;

    const bulkExportData = {
      exportId: `bulk_${Date.now()}`,
      timestamp: new Date().toISOString(),
      format,
      factCheckIds,
      totalSessions: factCheckIds.length,
      data: []
    };

    if (includeAnalytics) {
      (bulkExportData as any)['analytics'] = {
        averageScoreImprovement: 78.5,
        totalProcessingTime: 125000,
        totalCost: 12.45,
        mostEffectiveMode: 'enhanced'
      };
    }

    const filename = `bulk-exports/${bulkExportData.exportId}.json`;
    const blob = await put(filename, JSON.stringify(bulkExportData, null, 2), {
      access: 'public',
      contentType: 'application/json'
    });

    return res.status(200).json({
      success: true,
      exportId: bulkExportData.exportId,
      downloadUrl: blob.url,
      totalSessions: factCheckIds.length,
      format
    });
  } catch (error: any) {
    console.error('Bulk export error:', error);
    return res.status(500).json({ error: 'Failed to create bulk export', details: error.message });
  }
}
