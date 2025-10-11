import { FactCheckReport } from '@/types';

/**
 * Tracks usage and performance metrics for a fact-check analysis.
 * In a real-world scenario, this would send data to an analytics service.
 * @param report - The completed FactCheckReport.
 */
export const trackFactCheckUsage = (report: FactCheckReport): void => {
    const { metadata } = report;
    console.log('[Analytics] Tracking Fact-Check:', {
        method: metadata.method_used,
        processingTime: metadata.processing_time_ms,
        totalSources: metadata.sources_consulted.total,
        verdict: report.final_verdict,
        score: report.final_score,
    });
    // In a real application, this would send data to a service like
    // Google Analytics, Mixpanel, or a custom logging endpoint.
    // Example: analytics.track('FactCheckCompleted', { 
    //   method: metadata.method_used,
    //   duration: metadata.processing_time_ms 
    // });
};
