import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate the incoming data
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    // Generate filename with timestamp for editor results
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `editor-results/result-${timestamp}-${Math.random().toString(36).substr(2, 9)}.json`;

    // Store the editor result in Vercel Blob
    const blob = await put(filename, JSON.stringify(body, null, 2), {
      access: 'public',
      contentType: 'application/json'
    });

    return NextResponse.json({
      success: true,
      url: blob.url,
      filename: filename
    });

  } catch (error) {
    console.error('Blob storage error:', error);
    return NextResponse.json(
      { error: 'Failed to save to blob storage' },
      { status: 500 }
    );
  }
}