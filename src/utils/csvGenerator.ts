import { ContentPerformanceReport } from '../utils/performanceTracker';

export function generateCSVReport(report: ContentPerformanceReport): string {
  const headers = [
    'Metric',
    'Value',
    'Status',
    'Change',
    'Recommendation'
  ];

  const rows = [
    ['Total Views', report.summary.totalViews.toString(), 'Current', report.keyMetrics.traffic.averageChange.toString() + '%', 'Monitor traffic trends'],
    ['Average Position', report.summary.averagePosition.toString(), 'Current', '', 'Target top 10 positions'],
    ['Total Conversions', report.summary.totalConversions.toString(), 'Current', '', 'Optimize conversion funnel'],
    ['SEO Health Score', report.summary.seoHealthScore.toString(), 'Current', '', 'Maintain above 80'],
    ['Bounce Rate', report.keyMetrics.engagement.bounceRate.toString() + '%', 'Current', '', 'Target below 40%'],
    ['Time on Page', report.keyMetrics.engagement.timeOnPage.toString() + 's', 'Current', '', 'Target above 3 minutes'],
    ['Social Shares', report.keyMetrics.engagement.socialShares.toString(), 'Current', '', 'Increase social engagement'],
    ['Backlinks', report.keyMetrics.engagement.backlinks.toString(), 'Current', '', 'Build quality backlinks'],
    ['Keywords Tracked', report.keyMetrics.rankings.totalKeywords.toString(), 'Current', '', 'Expand keyword tracking'],
    ['Keywords Improved', report.keyMetrics.rankings.improved.toString(), 'Positive', '', 'Continue optimization'],
    ['Keywords Declined', report.keyMetrics.rankings.declined.toString(), 'Negative', '', 'Review and optimize'],
    ['Conversion Rate', report.keyMetrics.conversions.conversionRate.toString() + '%', 'Current', '', 'Optimize CTAs']
  ];

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}
