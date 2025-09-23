// api/blob/save-editor-result/route.ts
import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, mode, result, originalText, factCheckId } = body;

    // Create comprehensive blob data
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

    // Save to Vercel Blob with organized naming
    const filename = `editor-results/${factCheckId}/${mode}/${id}.json`;
    const blob = await put(filename, JSON.stringify(blobData, null, 2), {
      access: 'public',
      contentType: 'application/json'
    });

    // Optional: Save to database for indexing
    // await saveEditorResultToDatabase(blobData, blob.url);

    return NextResponse.json({
      success: true,
      url: blob.url,
      id: id,
      mode: mode
    });
  } catch (error) {
    console.error('Blob save error:', error);
    return NextResponse.json(
      { error: 'Failed to save editor result' },
      { status: 500 }
    );
  }
}
