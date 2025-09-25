import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Debugging: Check if the environment variable is available
    console.log(
      'BLOB_READ_WRITE_TOKEN is set:',
      !!process.env.BLOB_READ_WRITE_TOKEN
    );

    const facts = await request.json();
    const dbPath = 'fact-database/db.json';

    const blob = await put(dbPath, JSON.stringify(facts, null, 2), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
    });

    return NextResponse.json({ success: true, url: blob.url });
  } catch (error) {
    console.error('Failed to save fact database:', error);
    return NextResponse.json(
      { error: 'Failed to save fact database' },
      { status: 500 }
    );
  }
}