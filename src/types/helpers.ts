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

    // Scoring (using camelCase)
    finalScore: partial.finalScore ?? 0,
    finalVerdict: partial.finalVerdict || 'Analysis Incomplete',
    reasoning: partial.reasoning || 'Analysis in progress',

    // Evidence
    evidence: partial.evidence || [],

    // Enhanced fields with defaults
    enhanced_claim_text: partial.enhanced_claim_text || partial.originalText,
    originalTextSegments: partial.originalTextSegments || [],

    // Score breakdown (using camelCase)
    scoreBreakdown: partial.scoreBreakdown || {
      finalScoreFormula: 'Default scoring',
      metrics: [],
      confidenceIntervals: {
        lowerBound: 0,
        upperBound: 0,
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

    // Metadata (using camelCase)
    metadata: partial.metadata || {
      methodUsed: 'unknown',
      processingTimeMs: 0,
      apisUsed: [],
      sourcesConsulted: {
        total: 0,
        highCredibility: 0,
        conflicting: 0
      },
      warnings: []
    },

    // Required properties from FactCheckReport
    claimVerifications: partial.claimVerifications || [],

    // Optional fields (only include if provided)
    ...(partial.searchEvidence && { searchEvidence: partial.searchEvidence }),
    ...(partial.overallAuthenticityScore !== undefined && {
      overallAuthenticityScore: partial.overallAuthenticityScore
    }),
    ...(partial.summary && { summary: partial.summary }),
    ...(partial.category_rating && { category_rating: partial.category_rating }),
    ...(partial.media_verification_report && {
      media_verification_report: partial.media_verification_report
    }),
    ...(partial.corrections && { corrections: partial.corrections })
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
    finalScore: 0,
    finalVerdict: 'Error',
    reasoning: `Analysis failed: ${errorMessage}`,
    metadata: {
      methodUsed: method,
      processingTimeMs: 0,
      apisUsed: [],
      sourcesConsulted: { total: 0, highCredibility: 0, conflicting: 0 },
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
    credibilityScore: partial.credibilityScore ?? partial.score ?? 50,
    relevanceScore: partial.relevanceScore ?? 50,
    type: partial.type || 'search_result',
    title: partial.title || 'Untitled',
    snippet: partial.snippet || partial.quote || '',
    publicationDate: partial.publicationDate,
    publishedDate: partial.publishedDate || partial.publicationDate,
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
