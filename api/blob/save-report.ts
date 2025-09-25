import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server.js';

export async function POST(request: NextRequest) {
  try {
    const report = await request.json();
    const filename = `truescope-reports/${report.id}.json`;

    const blob = await put(filename, JSON.stringify(report), {
      access: 'public',
      addRandomSuffix: false,
    });

    return NextResponse.json({ success: true, url: blob.url });
  } catch (error) {
    console.error('Failed to save report to blob storage:', error);
    return NextResponse.json(
      { error: 'Failed to save report' },
      { status: 500 }
    );
  }
}