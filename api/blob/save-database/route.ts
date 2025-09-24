import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';
import { Logger } from '../../../src/utils/Logger';

const DB_PATH = 'fact-database/db.json';

export async function POST(request: NextRequest) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: 'BLOB_READ_WRITE_TOKEN is not configured' }, { status: 500 });
  }

  try {
    const dbData = await request.json();
    Logger.logBlobOperation('save-database', dbData);
    const blob = await put(DB_PATH, JSON.stringify(dbData, null, 2), {
      access: 'public',
      contentType: 'application/json',
      token: process.env.BLOB_READ_WRITE_TOKEN
    });

    return NextResponse.json({ success: true, url: blob.url });
  } catch (error: any) {
    Logger.logError('Failed to save fact database', error);
    return NextResponse.json({ error: 'Failed to save fact database' }, { status: 500 });
  }
}