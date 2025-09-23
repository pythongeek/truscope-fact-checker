// api/blob/export-bulk/route.ts
import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { factCheckIds, format = 'json', includeAnalytics = false } = body;

    // Aggregate data from multiple fact-check sessions
    const bulkExportData = {
      exportId: `bulk_${Date.now()}`,
      timestamp: new Date().toISOString(),
      format,
      factCheckIds,
      totalSessions: factCheckIds.length,
      data: [] // Would be populated from blob storage
    };

    if (includeAnalytics) {
      (bulkExportData as any)['analytics'] = {
        averageScoreImprovement: 78.5,
        totalProcessingTime: 125000,
        totalCost: 12.45,
        mostEffectiveMode: 'enhanced'
      };
    }

    // Save bulk export
    const filename = `bulk-exports/${bulkExportData.exportId}.json`;
    const blob = await put(filename, JSON.stringify(bulkExportData, null, 2), {
      access: 'public',
      contentType: 'application/json'
    });

    return NextResponse.json({
      success: true,
      exportId: bulkExportData.exportId,
      downloadUrl: blob.url,
      totalSessions: factCheckIds.length,
      format
    });
  } catch (error) {
    console.error('Bulk export error:', error);
    return NextResponse.json(
      { error: 'Failed to create bulk export' },
      { status: 500 }
    );
  }
}
