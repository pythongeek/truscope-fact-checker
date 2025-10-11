import { FactCheckReport, EvidenceItem, FactCheckMetadata } from './index';

/**
 * Helper type for creating FactCheckReport objects incrementally
 * Provides sensible defaults for all required properties
 */
export type PartialFactCheckReport = Partial<FactCheckReport> & {
  originalText: string; // Only this is truly required
};

/**
 * Converts a partial report to a complete FactCheckReport with defaults
 */
export function completeFactCheckReport(
  partial: PartialFactCheckReport
): FactCheckReport {
  const now = Date.now();

  return {
    // Required basics
    id: partial.id || `report-${now}`,
    originalText: partial.originalText,

    // Scoring
    final_score: partial.final_score ?? 0,
    final_verdict: partial.final_verdict || 'Analysis Incomplete',
    reasoning: partial.reasoning || 'Analysis in progress',

    // Evidence
    evidence: partial.evidence || [],

    // Enhanced fields with defaults
    enhanced_claim_text: partial.enhanced_claim_text || partial.originalText,
    originalTextSegments: partial.originalTextSegments || [],

    // Score breakdown
    score_breakdown: partial.score_breakdown || {
      final_score_formula: 'Default scoring',
      metrics: [],
      confidence_intervals: {
        lower_bound: 0,
        upper_bound: 0,
      },
    },

    // Source credibility
    source_credibility_report: partial.source_credibility_report || {
      overallScore: 0,
      highCredibilitySources: 0,
      flaggedSources: 0,
      biasWarnings: [],
      credibilityBreakdown: {
        academic: 0,
        news: 0,
        government: 0,
        social: 0
      }
    },

    // Temporal verification
    temporal_verification: partial.temporal_verification || {
      hasTemporalClaims: false,
      validations: [],
      overallTemporalScore: 0,
      temporalWarnings: []
    },

    // Metadata
    metadata: partial.metadata || {
      method_used: 'unknown',
      processing_time_ms: 0,
      apisUsed: [],
      sources_consulted: {
        total: 0,
        high_credibility: 0,
        conflicting: 0
      },
      warnings: []
    },

    // Optional fields (only include if provided)
    ...(partial.searchEvidence && { searchEvidence: partial.searchEvidence }),
    ...(partial.claimVerifications && { claimVerifications: partial.claimVerifications }),
    ...(partial.overallAuthenticityScore !== undefined && {
      overallAuthenticityScore: partial.overallAuthenticityScore
    }),
    ...(partial.summary && { summary: partial.summary }),
    ...(partial.category_rating && { category_rating: partial.category_rating }),
    ...(partial.media_verification_report && {
      media_verification_report: partial.media_verification_report
    })
  };
}

/**
 * Creates a minimal valid FactCheckReport for error cases
 */
export function createErrorReport(
  text: string,
  error: Error | string,
  method: string = 'unknown'
): FactCheckReport {
  const errorMessage = error instanceof Error ? error.message : error;

  return completeFactCheckReport({
    originalText: text,
    final_score: 0,
    final_verdict: 'Error',
    reasoning: `Analysis failed: ${errorMessage}`,
    metadata: {
      method_used: method,
      processing_time_ms: 0,
      apisUsed: [],
      sources_consulted: { total: 0, high_credibility: 0, conflicting: 0 },
      warnings: [`Error: ${errorMessage}`]
    }
  });
}

/**
 * Helper for creating default EvidenceItem
 */
export function createDefaultEvidence(partial: Partial<EvidenceItem>): EvidenceItem {
  return {
    id: partial.id || `evidence-${Date.now()}-${Math.random()}`,
    publisher: partial.publisher || 'Unknown',
    url: partial.url || '',
    quote: partial.quote || '',
    score: partial.score ?? 50,
    type: partial.type || 'search_result',
    title: partial.title || 'Untitled',
    snippet: partial.snippet || partial.quote || '',
    source: partial.source || {
      name: partial.publisher || 'Unknown',
      url: partial.url || '',
      credibility: {
        rating: 'Medium',
        classification: 'General',
        warnings: []
      }
    }
  };
}
