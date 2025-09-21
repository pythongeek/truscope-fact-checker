export interface ContentPerformanceReport {
  // This is a placeholder. The full definition should be provided later.
  summary: {
    totalViews: number;
    averagePosition: number;
    totalConversions: number;
    seoHealthScore: number;
  };
  keyMetrics: {
    traffic: {
      averageChange: number;
    };
    engagement: {
      bounceRate: number;
      timeOnPage: number;
      socialShares: number;
      backlinks: number;
    };
    rankings: {
      totalKeywords: number;
      improved: number;
      declined: number;
    };
    conversions: {
      conversionRate: number;
    };
  };
}
