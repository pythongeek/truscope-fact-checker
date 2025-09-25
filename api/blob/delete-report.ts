import { del } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { reportId } = await request.json();
    const filename = `truescope-reports/${reportId}.json`;

    await del(filename);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete report from blob storage:', error);
    return NextResponse.json(
      { error: 'Failed to delete report' },
      { status: 500 }
    );
  }
}