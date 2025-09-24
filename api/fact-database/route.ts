import { put, head } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';
import { Logger } from '../../src/utils/Logger';

const DB_PATH = 'fact-database/db.json';

async function createInitialDatabase() {
  const initialData = {
    facts: [],
    metadata: {
      created: new Date().toISOString(),
      version: '1.0.0',
      total_facts: 0
    }
  };

  Logger.logBlobOperation('create-initial-database', initialData);
  const blob = await put(DB_PATH, JSON.stringify(initialData), {
    access: 'public',
    contentType: 'application/json',
    token: process.env.BLOB_READ_WRITE_TOKEN
  });

  console.log('Created initial fact database:', blob.url);
  return initialData;
}

export async function GET(request: NextRequest) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: 'BLOB_READ_WRITE_TOKEN is not configured' }, { status: 500 });
  }

  try {
    const blob = await head(DB_PATH, { token: process.env.BLOB_READ_WRITE_TOKEN });
    const response = await fetch(blob.url);
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    if (error.status === 404 || (error.message && error.message.includes('404'))) {
      Logger.logError('Fact database not found, creating a new one.', error);
      const initialData = await createInitialDatabase();
      return NextResponse.json(initialData);
    }
    Logger.logError('Failed to fetch fact database', error);
    return NextResponse.json({ error: 'Failed to fetch fact database' }, { status: 500 });
  }
}