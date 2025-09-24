import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';
import { Logger } from '../../../src/utils/Logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, mode, result, originalText, factCheckId } = body;

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error('BLOB_READ_WRITE_TOKEN is not configured');
    }

    const blobData = {
      id,
      timestamp: new Date().toISOString(),
      type: 'editor-result',
      factCheckId,
      mode,
      originalText,
      result,
      metadata: {
        version: '1.0',
        platform: 'truescope-ai',
        environment: process.env.NODE_ENV
      }
    };

    const filename = `editor-results/${factCheckId}/${mode}/${id}.json`;
    Logger.logBlobOperation('save-editor-result', blobData);
    const blob = await put(filename, JSON.stringify(blobData, null, 2), {
      access: 'public',
      contentType: 'application/json',
      token: process.env.BLOB_READ_WRITE_TOKEN
    });

    return NextResponse.json({
      success: true,
      url: blob.url,
      id: id,
      mode: mode
    });
  } catch (error) {
    Logger.logError('Blob save-editor-result error', error);
    return NextResponse.json(
      { error: `Failed to save editor result: ${error.message}` },
      { status: 500 }
    );
  }
}