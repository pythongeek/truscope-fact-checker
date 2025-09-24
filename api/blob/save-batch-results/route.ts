import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';
import { Logger } from '../../../src/utils/Logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, results, originalText, factCheckId, timestamp } = body;

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error('BLOB_READ_WRITE_TOKEN is not configured');
    }

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
        batchProcessingTime: results.reduce((sum: number, r: any) => sum + (r.processingTime || 0), 0)
      }
    };

    const batchFilename = `batch-results/${factCheckId}/${id}.json`;
    Logger.logBlobOperation('save-batch-results', batchData);
    const batchBlob = await put(batchFilename, JSON.stringify(batchData, null, 2), {
      access: 'public',
      contentType: 'application/json',
      token: process.env.BLOB_READ_WRITE_TOKEN
    });

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
          contentType: 'application/json',
          token: process.env.BLOB_READ_WRITE_TOKEN
        });
        return { mode: result.mode, url: blob.url };
      })
    );

    return NextResponse.json({
      success: true,
      batchUrl: batchBlob.url,
      urls: individualUrls,
      totalResults: results.length
    });
  } catch (error) {
    Logger.logError('Batch blob save error', error);
    return NextResponse.json(
      { error: `Failed to save batch results: ${error.message}` },
      { status: 500 }
    );
  }
}