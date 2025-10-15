import { FactCheckReport, FactCheckMethod, EvidenceItem, ScoreBreakdown, ClaimVerification, ExtractedEntity } from '@/types';
import { SourceCredibilityReport, MediaVerificationReport, TimelineEvent, TemporalValidation, CategoryRating } from '@/types/enhancedFactCheck';
import { CitationAugmentedService } from './analysis/CitationAugmentedService';
import { TemporalContextService } from './core/TemporalContextService';
import { SourceCredibilityService } from './core/SourceCredibilityService';
import { CategoryRatingService } from './core/CategoryRatingService';
import { PipelineIntegration, EnhancedSearchResult, PipelineExecutionMetrics, PipelineResult } from './analysis/PipelineIntegration';
import { search as basicSearch } from './webSearch'; // Assuming webSearch can be imported directly

/**
 * EnhancedFactCheckService orchestrates a multi-faceted fact-checking process.
 * It integrates various services to provide a comprehensive analysis of a given text,
 * including citation analysis, temporal validation, and source credibility assessment.
 */
export class EnhancedFactCheckService {
  private citationService: CitationAugmentedService;
  private temporalService: TemporalContextService;
  private credibilityService: SourceCredibilityService;
  private ratingService: CategoryRatingService;
  private pipelineIntegration: PipelineIntegration;

  constructor() {
    this.citationService = new CitationAugmentedService();
    this.temporalService = TemporalContextService.getInstance();
    this.credibilityService = SourceCredibilityService.getInstance();
    this.ratingService = CategoryRatingService.getInstance();
    this.pipelineIntegration = PipelineIntegration.getInstance();
  }

  /**
   * Orchestrates the fact-checking process based on the selected method.
   * @param text The text to be fact-checked.
   * @param method The fact-checking method to use ('COMPREHENSIVE' or 'TEMPORAL').
   * @returns A promise that resolves to a FactCheckReport.
   */
  async orchestrateFactCheck(text: string, method: FactCheckMethod): Promise<FactCheckReport> {
    const startTime = Date.now();
    try {
      switch (method) {
        case 'COMPREHENSIVE':
          return await this.runComprehensiveAnalysis(text);
        case 'TEMPORAL':
          return await this.runTemporalVerification(text);
        default:
          // Fallback to the comprehensive method for any unspecified cases.
          return await this.runComprehensiveAnalysis(text);
      }
    } catch (error: unknown) {
      const processingTime = Date.now() - startTime;
      return this.generateErrorReport(text, method, error, processingTime);
    }
  }

  /**
   * Fetches and augments search results using the advanced query pipeline.
   * This is the primary method for gathering evidence.
   * @param text The text to be analyzed.
   * @returns A promise resolving to a base FactCheckReport.
   */
  private async fetchAndAugmentWithSearch(text: string): Promise<FactCheckReport> {
    console.log('🚀 Starting Enhanced Search with Advanced Query Pipeline...');
    const startTime = Date.now();

    try {
      // STEP 1: Process text through the advanced pipeline to get rich analysis and search results.
      const enhancedSearch: EnhancedSearchResult = await this.pipelineIntegration.processAndSearch(
        text,
        {
          executePhase2: true,  // Execute follow-up queries for deeper analysis.
          executePhase3: false, // Skip deep dive for performance; enable for complex claims.
          maxResultsPerQuery: 10
        }
      );

      const { pipelineResult, aggregatedEvidence, executionMetrics } = enhancedSearch;

      // STEP 2: Log key insights from the pipeline execution.
      this.logPipelineInsights(pipelineResult, executionMetrics, aggregatedEvidence);
      
      // NOTE: We now assume `aggregatedEvidence` contains richer data including siteName, publicationDate, etc.
      // This richer `EvidenceItem` will be used by downstream services.

      // STEP 3: Process the aggregated evidence to generate a citation-augmented report.
      const processedReport = await this.citationService.processSearchResults(
        text,
        aggregatedEvidence
      );

      // STEP 4: Enrich the report with metadata from the pipeline.
      const enrichedReport = this.enrichReportWithPipelineData(processedReport, pipelineResult, executionMetrics);

      const processingTime = Date.now() - startTime;
      console.log(`✅ Enhanced search completed in ${processingTime}ms`);
      return enrichedReport;

    } catch (error) {
      console.error('❌ Enhanced search with pipeline failed:', error);
      console.warn('⚠️ Falling back to basic search method...');
      return await this.fallbackBasicSearch(text);
    }
  }

  /**
   * Logs key metrics and insights from the pipeline's execution.
   */
  private logPipelineInsights(pipelineResult: PipelineResult, executionMetrics: PipelineExecutionMetrics, aggregatedEvidence: EvidenceItem[]): void {
    console.log('\n📊 Pipeline Analysis Results:');
    console.log(`   - Entities Extracted: ${pipelineResult.textAnalysis.namedEntities.length}`);
    console.log(`   - Atomic Claims: ${pipelineResult.textAnalysis.atomicClaims.length}`);
    console.log(`   - Primary Keywords: ${pipelineResult.semanticExtraction.primaryKeywords.length}`);
    console.log(`   - Queries Generated: ${pipelineResult.rankedQueries.length}`);
    console.log(`   - Queries Executed: ${executionMetrics.totalQueriesExecuted}`);
    console.log(`   - Results Retrieved: ${executionMetrics.totalResultsReturned}`);
    console.log(`   - Evidence Items: ${aggregatedEvidence.length}\n`);
  }

  /**
   * Enriches the fact-check report with metadata from the analysis pipeline.
   */
  private enrichReportWithPipelineData(
    report: FactCheckReport,
    pipelineResult: PipelineResult,
    executionMetrics: PipelineExecutionMetrics
  ): FactCheckReport {
    // Map atomic claims and named entities to the report structure.
    const claimBreakdown: ClaimVerification[] = pipelineResult.textAnalysis.atomicClaims.map(claim => ({
      id: claim.id,
      text: claim.claimText,
      type: claim.claimType,
      verifiability: claim.verifiability,
      priority: claim.priority
    }));

    const extractedEntities: ExtractedEntity[] = pipelineResult.textAnalysis.namedEntities.map(entity => ({
      name: entity.text,
      type: entity.type,
      relevance: entity.relevance
    }));

    return {
      ...report,
      metadata: {
        ...report.metadata,
        apisUsed: [
          ...(report.metadata.apisUsed ?? []),
          'advanced-query-pipeline',
          'deep-text-analysis',
          'semantic-extraction',
          'intelligent-query-synthesis'
        ],
        warnings: [
          ...(report.metadata.warnings ?? []),
          ...this.generatePipelineWarnings(pipelineResult, executionMetrics)
        ],
        pipelineMetadata: {
          complexity: pipelineResult.textAnalysis.complexity,
          suggestedSearchDepth: pipelineResult.textAnalysis.suggestedSearchDepth,
          entitiesExtracted: pipelineResult.textAnalysis.namedEntities.length,
          atomicClaimsIdentified: pipelineResult.textAnalysis.atomicClaims.length,
          queriesGenerated: pipelineResult.rankedQueries.length,
          queriesExecuted: executionMetrics.totalQueriesExecuted,
          avgQueryTime: executionMetrics.averageQueryTime,
          pipelineVersion: pipelineResult.metadata.pipelineVersion,
          processingTime: pipelineResult.metadata.totalProcessingTime
        }
      },
      claimBreakdown,
      extractedEntities
    };
  }

  /**
   * Generates warning messages based on the pipeline analysis results.
   */
  private generatePipelineWarnings(pipelineResult: PipelineResult, executionMetrics: PipelineExecutionMetrics): string[] {
    const warnings: string[] = [];
    if (pipelineResult.textAnalysis.complexity === 'complex') {
      warnings.push('Complex claim structure detected - verification may require multiple sources.');
    }
    const temporalContext = pipelineResult.textAnalysis.temporalContext;
    if (temporalContext && temporalContext.hasDateReference && temporalContext.recency === 'breaking') {
        warnings.push('Recent claim - information may still be developing.');
    }
    if (executionMetrics.totalResultsReturned < 5) {
      warnings.push('Limited search results found - claim may be obscure or very recent.');
    }
    const biasIndicators = pipelineResult.textAnalysis.biasIndicators;
    if (biasIndicators && biasIndicators.overallBiasScore > 70) {
        warnings.push('High bias indicators detected in original text.');
    }
    if (pipelineResult.textAnalysis.namedEntities.length === 0) {
      warnings.push('No named entities extracted - verification may be challenging.');
    }
    return warnings;
  }


  /**
   * A fallback search method in case the advanced pipeline fails.
   * @param text The text to be fact-checked.
   * @returns A promise resolving to a basic FactCheckReport.
   */
  private async fallbackBasicSearch(text: string): Promise<FactCheckReport> {
    const basicQueries = [
      `fact check "${text.substring(0, 50)}"`,
      `${text.substring(0, 30)} verification`,
      `is "${text.substring(0, 40)}" true`
    ];
    const searchResults = await Promise.all(
      basicQueries.map(query => basicSearch(query, 5))
    );
    const allResults = searchResults.flat();
    
    // Ensure the evidence from basic search also includes detailed metadata.
    // This might require a transformation step here if the basicSearch API is less detailed.
    const transformedResults: EvidenceItem[] = allResults.map(result => ({
        ...result,
        siteName: result.url ? new URL(result.url).hostname : 'Unknown',
        publicationDate: result.publicationDate || new Date().toISOString(), // Default to now if not available
        // Add other fields as necessary
    }));

    return await this.citationService.processSearchResults(text, transformedResults);
  }

  /**
   * Runs a comprehensive analysis including web search, source credibility, and temporal validation.
   * @param text The text to be analyzed.
   * @returns A promise resolving to a detailed FactCheckReport.
   */
  private async runComprehensiveAnalysis(text: string): Promise<FactCheckReport> {
    console.log('🔍 Running Comprehensive Analysis with Web Search...');
    const baseReport = await this.fetchAndAugmentWithSearch(text);
    const sourceCredibilityReport = await this.generateSourceCredibilityReport(baseReport.evidence);
    const temporalValidations = this.temporalService.evaluateTemporalClaims(text);
    const temporalScore = this.calculateTemporalScore(temporalValidations);
    const mediaVerificationReport = await this.generateMediaVerificationReport(text);

    const finalScore = this.calculateComprehensiveScore(
      baseReport.finalScore ?? 0,
      sourceCredibilityReport.overallScore,
      temporalScore,
      mediaVerificationReport
    );

    const categoryRating = this.ratingService.convertScoreToCategory(
      finalScore,
      sourceCredibilityReport.overallScore,
      baseReport.evidence.length
    );
    
    // Consolidating temporal verification logic
    const temporalVerification = {
        hasTemporalClaims: temporalValidations.length > 0,
        validations: temporalValidations,
        overallTemporalScore: temporalScore,
        temporalWarnings: temporalValidations.filter(v => !v.isValid).map(v => v.reasoning)
    };

    return {
      ...baseReport,
      finalScore: finalScore,
      finalVerdict: 'Comprehensive Analysis',
      categoryRating: categoryRating,
      sourceCredibilityReport: sourceCredibilityReport,
      mediaVerificationReport: mediaVerificationReport,
      temporalVerification: temporalVerification,
      metadata: {
        ...baseReport.metadata,
        methodUsed: 'comprehensive',
        apisUsed: [...(baseReport.metadata.apisUsed || []), 'source-credibility', 'temporal-context', 'media-verification'],
        warnings: [
          ...(baseReport.metadata.warnings || []),
          ...sourceCredibilityReport.biasWarnings,
          ...temporalVerification.temporalWarnings.map(w => `Temporal: ${w}`)
        ]
      }
    };
  }

  /**
   * Runs a focused temporal verification on the text.
   * @param text The text to be analyzed.
   * @returns A promise resolving to a FactCheckReport focused on temporal aspects.
   */
  private async runTemporalVerification(text: string): Promise<FactCheckReport> {
    console.log('⏰ Running Temporal Verification...');
    const temporalValidations = this.temporalService.evaluateTemporalClaims(text);
    const baseReport = await this.citationService.performCitationAugmentedAnalysis(text);
    const recentNewsScore = await this.calculateRecentNewsScore(text, temporalValidations);
    const temporalScore = this.calculateTemporalScore(temporalValidations);
    
    const finalScore = Math.round(((baseReport.finalScore ?? 0) * 0.4) + (temporalScore * 0.4) + (recentNewsScore * 0.2));
    
    const sourceCredibilityReport = await this.generateBasicSourceCredibilityReport(baseReport.evidence);
    
    const categoryRating = this.ratingService.convertScoreToCategory(
      finalScore,
      sourceCredibilityReport.overallScore,
      baseReport.evidence.length
    );
    
    // Consolidating temporal verification logic
    const timelineAnalysis = await this.generateTimelineAnalysis(text, temporalValidations);
    const temporalVerification = {
        hasTemporalClaims: temporalValidations.length > 0,
        validations: temporalValidations,
        overallTemporalScore: temporalScore,
        temporalWarnings: temporalValidations.filter(v => !v.isValid).map(v => v.reasoning),
        timelineAnalysis: timelineAnalysis
    };

    return {
      ...baseReport,
      finalScore: finalScore,
      finalVerdict: temporalValidations.every(v => v.isValid) ? 'TRUE' : 'FALSE',
      categoryRating: categoryRating,
      sourceCredibilityReport: sourceCredibilityReport,
      temporalVerification: temporalVerification,
      metadata: {
        ...baseReport.metadata,
        methodUsed: 'temporal-verification',
        apisUsed: [...(baseReport.metadata.apisUsed || []), 'temporal-context', 'recent-news'],
        warnings: [
          ...(baseReport.metadata.warnings || []),
          ...temporalVerification.temporalWarnings.map(w => `Temporal: ${w}`)
        ]
      }
    };
  }

  private calculateTemporalScore(validations: TemporalValidation[]): number {
    if (validations.length === 0) return 100; // Assume valid if no claims
    const validCount = validations.filter(v => v.isValid).length;
    return (validCount / validations.length) * 100;
  }

  /**
   * Generates a detailed source credibility report.
   * @param evidence A list of evidence items.
   * @returns A promise resolving to a SourceCredibilityReport.
   */
  private async generateSourceCredibilityReport(evidence: EvidenceItem[]): Promise<SourceCredibilityReport> {
    const sourceAnalyses = await Promise.all(
      evidence.map(e => e.url ? this.credibilityService.analyzeSource(e.url) : null)
    );
    
    const validSources = sourceAnalyses.filter((s): s is NonNullable<typeof s> => s !== null);
    
    // Using a more robust way to get URLs for bias warnings
    const urlsForBiasCheck = evidence.map(e => ({ url: e.url })).filter(e => e.url);

    return {
      overallScore: this.credibilityService.calculateWeightedScore(evidence),
      highCredibilitySources: validSources.filter(s => s.credibilityScore >= 85).length,
      flaggedSources: validSources.filter(s => s.verificationStatus === 'flagged').length,
      biasWarnings: this.credibilityService.getBiasWarnings(urlsForBiasCheck),
      credibilityBreakdown: {
        academic: validSources.filter(s => s.category === 'academic').length,
        news: validSources.filter(s => s.category === 'news').length,
        government: validSources.filter(s => s.category === 'government').length,
        social: validSources.filter(s => s.category === 'social').length,
        other: validSources.filter(s => !['academic', 'news', 'government', 'social'].includes(s.category)).length
      }
    };
  }

  /**
   * Generates a basic source credibility report for temporal verification.
   */
  private async generateBasicSourceCredibilityReport(evidence: EvidenceItem[]): Promise<SourceCredibilityReport> {
    return {
      overallScore: this.credibilityService.calculateWeightedScore(evidence),
      highCredibilitySources: evidence.filter(e => (e.score ?? 0) >= 85).length,
      flaggedSources: 0,
      biasWarnings: [],
      credibilityBreakdown: { academic: 0, news: evidence.length, government: 0, social: 0, other: 0 }
    };
  }

  /**
   * Placeholder for media verification logic.
   */
  private async generateMediaVerificationReport(text: string): Promise<MediaVerificationReport> {
    // This can be expanded to include actual reverse image search logic.
    return { hasVisualContent: false, reverseImageResults: [] };
  }

  /**
   * Calculates the final comprehensive score.
   */
  private calculateComprehensiveScore(baseScore: number, credibilityScore: number, temporalScore: number, mediaReport: MediaVerificationReport): number {
    const mediaScoreWeight = mediaReport.hasVisualContent ? 0.1 : 0;
    const baseWeight = 0.5 - mediaScoreWeight;
    // Dummy media score for now
    const mediaScore = 0;
    
    return Math.round((baseScore * baseWeight) + (credibilityScore * 0.3) + (temporalScore * 0.2) + (mediaScore * mediaScoreWeight));
  }


  /**
   * Calculates a score based on how recent the news is.
   */
  private async calculateRecentNewsScore(text: string, temporalValidations: TemporalValidation[]): Promise<number> {
    if (temporalValidations.length === 0) return 70;
    const recentValidations = temporalValidations.filter(v => v.dateType === 'present' || v.dateType === 'near_future');
    return recentValidations.length > 0 ? 85 : 60;
  }

  /**
   * Generates a timeline analysis for temporal claims.
   */
  private async generateTimelineAnalysis(text: string, validations: TemporalValidation[]): Promise<{ events: TimelineEvent[], consistency: number }> {
    // This can be expanded to build an actual timeline of events.
    return {
      events: [],
      consistency: this.calculateTemporalScore(validations)
    };
  }

  /**
   * Generates a standardized error report.
   */
  private generateErrorReport(text: string, method: FactCheckMethod, error: any, processingTime: number): FactCheckReport {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error(`Error during ${method} analysis:`, error);
    
    const defaultScoreBreakdown: ScoreBreakdown = {
      metrics: [],
      finalScoreFormula: "Error during calculation"
    };

    return {
      id: `error-${Date.now()}`,
      originalText: text,
      finalVerdict: 'Error',
      finalScore: 0,
      reasoning: `Analysis failed for method '${method}': ${errorMessage}`,
      evidence: [],
      claimVerifications: [],
      enhancedClaimText: text,
      sourceCredibilityReport: this.generateBasicSourceCredibilityReport([]).then(r => r), // Simplified for error case
      temporalVerification: {
        hasTemporalClaims: false,
        validations: [],
        overallTemporalScore: 0,
        temporalWarnings: []
      },
      metadata: {
        methodUsed: method,
        processingTimeMs: processingTime,
        apisUsed: ['error-handling'],
        sourcesConsulted: { total: 0, highCredibility: 0, conflicting: 0 },
        warnings: [`Analysis failed: ${errorMessage}`]
      },
      scoreBreakdown: defaultScoreBreakdown,
    };
  }
}

// Singleton instance of the service
const enhancedFactCheckService = new EnhancedFactCheckService();

/**
 * Public function to initiate a fact-check request.
 * @param text The text to be fact-checked.
 * @param method The method to use for fact-checking.
 * @returns A promise resolving to a FactCheckReport.
 */
export const enhancedFactCheck = (
  text: string,
  method: FactCheckMethod = 'COMPREHENSIVE',
): Promise<FactCheckReport> => {
  return enhancedFactCheckService.orchestrateFactCheck(text, method);
};
