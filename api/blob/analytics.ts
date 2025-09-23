// api/blob/analytics/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '7d'; // 7d, 30d, 90d
    const type = searchParams.get('type'); // 'editor-result', 'batch-results'

    // Mock analytics data - in production, aggregate from blob storage
    const analyticsData = {
      period,
      type,
      metrics: {
        totalProcessings: Math.floor(Math.random() * 1000),
        averageImprovementScore: Math.floor(Math.random() * 30) + 70,
        mostUsedMode: 'enhanced',
        totalCost: (Math.random() * 50).toFixed(2),
        processingTimeAvg: Math.floor(Math.random() * 30000) + 10000
      },
      trends: {
        daily: Array.from({ length: 7 }, (_, i) => ({
          date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          count: Math.floor(Math.random() * 50),
          avgScore: Math.floor(Math.random() * 20) + 75
        })).reverse()
      },
      modeUsage: {
        'quick-fix': 35,
        'enhanced': 28,
        'seo-optimized': 15,
        'complete-rewrite': 12,
        'academic': 7,
        'expansion': 3
      }
    };

    return NextResponse.json(analyticsData);
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to load analytics' },
      { status: 500 }
    );
  }
}
