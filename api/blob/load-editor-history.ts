// api/blob/load-editor-history/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const factCheckId = searchParams.get('factCheckId');
    const mode = searchParams.get('mode');

    if (!factCheckId) {
      return NextResponse.json(
        { error: 'factCheckId is required' },
        { status: 400 }
      );
    }

    // In a real implementation, you would query your database
    // or use Vercel Blob list functionality to get historical results
    const mockHistory = {
      factCheckId,
      results: [] // This would be populated from actual blob storage
    };

    return NextResponse.json(mockHistory);
  } catch (error) {
    console.error('Load history error:', error);
    return NextResponse.json(
      { error: 'Failed to load editor history' },
      { status: 500 }
    );
  }
}
