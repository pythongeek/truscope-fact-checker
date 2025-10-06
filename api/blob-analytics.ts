import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { period = '7d', type } = req.query;

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

    return res.status(200).json(analyticsData);
  } catch (error: any) {
    console.error('Analytics error:', error);
    return res.status(500).json({ error: 'Failed to load analytics', details: error.message });
  }
}
