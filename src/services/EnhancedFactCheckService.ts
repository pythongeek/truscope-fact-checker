import { FactCheckReport, FactCheckMethod, EvidenceItem, ScoreBreakdown, ClaimVerification, GoogleSearchResult } from '@/types';
import { SourceCredibilityReport, MediaVerificationReport, TimelineEvent, TemporalValidation, CategoryRating } from '@/types/enhancedFactCheck';
import { CitationAugmentedService } from './analysis/CitationAugmentedService';
import { TemporalContextService } from './core/TemporalContextService';
import { SourceCredibilityService } from './core/SourceCredibilityService';
import { CategoryRatingService } from './core/CategoryRatingService';
import { PipelineIntegration, EnhancedSearchResult } from './analysis/PipelineIntegration';
import { PipelineResult } from './analysis/AdvancedQueryPipeline';

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

  async orchestrateFactCheck(text: string, method: FactCheckMethod): Promise<FactCheckReport> {
    const startTime = Date.now();

    try {
      switch (method) {
        case 'COMPREHENSIVE':
          return await this.runComprehensiveAnalysis(text);
        case 'TEMPORAL':
          return await this.runTemporalVerification(text);
        default:
          return await this.runComprehensiveAnalysis(text);
      }
    } catch (error) {
      return this.generateErrorReport(text, method, error, Date.now() - startTime);
    }
  }

  private async _fetchAndAugmentWithSearch(text: string): Promise<FactCheckReport> {
    console.log('🚀 Starting Enhanced Search with Advanced Query Pipeline...');
    const startTime = Date.now();

    try {
      const enhancedSearch: EnhancedSearchResult = await this.pipelineIntegration.processAndSearch(
        text,
        {
          executePhase2: true,
          executePhase3: false,
          maxResultsPerQuery: 10
        }
      );

      const { pipelineResult, aggregatedEvidence, executionMetrics } = enhancedSearch;

      console.log('\n📊 Pipeline Analysis Results:');
      console.log(`- Entities Extracted: ${pipelineResult.textAnalysis.namedEntities.length}`);
      console.log(`- Atomic Claims: ${pipelineResult.textAnalysis.atomicClaims.length}`);
      console.log(`- Primary Keywords: ${pipelineResult.semanticExtraction.primaryKeywords.length}`);
      console.log(`- Queries Generated: ${pipelineResult.rankedQueries.length}`);
      console.log(`- Queries Executed: ${executionMetrics.totalQueriesExecuted}`);
      console.log(`- Results Retrieved: ${executionMetrics.totalResultsReturned}`);
      console.log(`- Evidence Items: ${aggregatedEvidence.length}\n`);

      const processedReport = await this.citationService.processSearchResults(
        text,
        aggregatedEvidence
      );

      const enrichedReport: FactCheckReport = {
        ...processedReport,
        metadata: {
          ...processedReport.metadata,
          apisUsed: [
            ...(processedReport.metadata.apisUsed ?? []),
            'advanced-query-pipeline',
            'deep-text-analysis',
            'semantic-extraction',
            'intelligent-query-synthesis'
          ],
          warnings: [
            ...(processedReport.metadata.warnings ?? []),
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
        claimVerifications: pipelineResult.textAnalysis.atomicClaims.map((claim: any) => ({
            id: claim.id,
            claimText: claim.claimText,
            status: 'Unverified',
            confidenceScore: 0,
            explanation: '',
            evidence: [],
            reasoning: '',
            claim: claim.claimText,
            confidence: 0
        })),
        extractedEntities: pipelineResult.textAnalysis.namedEntities.map((entity: any) => ({
          name: entity.text,
          type: entity.type,
          relevance: entity.relevance
        }))
      };

      const processingTime = Date.now() - startTime;
      console.log(`✅ Enhanced search completed in ${processingTime}ms`);
      return enrichedReport;

    } catch (error) {
      console.error('❌ Enhanced search with pipeline failed:', error);
      console.warn('⚠️  Falling back to basic search method...');
      return await this.fallbackBasicSearch(text);
    }
  }

  private async fallbackBasicSearch(text: string): Promise<FactCheckReport> {
    const { search } = await import('./webSearch');
    const basicQueries = [
      `fact check "${text.substring(0, 50)}"`,
      `${text.substring(0, 30)} verification`,
      `is "${text.substring(0, 40)}" true`
    ];
    const searchResults = await Promise.all(
      basicQueries.map(query => search(query, 5))
    );
    const allResults = searchResults.flat();

    const evidenceItems: EvidenceItem[] = allResults.map((result: GoogleSearchResult, index: number) => ({
        id: `fallback-${index}`,
        url: result.url,
        title: result.title,
        snippet: result.snippet,
        publisher: result.source || 'Unknown',
        publicationDate: result.date,
        credibilityScore: 50,
        relevanceScore: 50,
        type: 'search_result',
        source: {
            name: result.source || 'Unknown',
            url: result.url,
            credibility: {
                rating: 'Unknown',
                classification: 'Unknown',
                warnings: []
            }
        },
        score: 50,
    }));

    return await this.citationService.processSearchResults(text, evidenceItems);
  }

  private async runComprehensiveAnalysis(text: string): Promise<FactCheckReport> {
    console.log('🔍 Running Comprehensive Analysis with Web Search...');
    const baseReport = await this._fetchAndAugmentWithSearch(text);
    const sourceCredibilityReport = await this.generateSourceCredibilityReport(baseReport.evidence);
    const temporalValidations = this.temporalService.evaluateTemporalClaims(text);
    const temporalScore = temporalValidations.filter(v => v.isValid).length / Math.max(temporalValidations.length, 1) * 100;
    const mediaVerificationReport = await this.generateMediaVerificationReport(text);
    const finalScore = this.calculateComprehensiveScore(
      baseReport.final_score ?? 0,
      sourceCredibilityReport.overallScore,
      temporalScore,
      mediaVerificationReport
    );
    const categoryRating = this.ratingService.convertScoreToCategory(
      finalScore,
      sourceCredibilityReport.overallScore,
      baseReport.evidence.length
    );

    return {
      ...baseReport,
      finalScore: finalScore,
      final_score: finalScore,
      finalVerdict: 'Comprehensive Analysis',
      final_verdict: 'Comprehensive Analysis',
      categoryRating: categoryRating,
      category_rating: categoryRating,
      sourceCredibilityReport: sourceCredibilityReport,
      source_credibility_report: sourceCredibilityReport,
      mediaVerificationReport: mediaVerificationReport,
      media_verification_report: mediaVerificationReport,
      temporalVerification: {
        hasTemporalClaims: temporalValidations.length > 0,
        validations: temporalValidations,
        overallTemporalScore: temporalScore,
        temporalWarnings: temporalValidations.filter(v => !v.isValid).map(v => v.reasoning)
      },
      temporal_verification: {
        hasTemporalClaims: temporalValidations.length > 0,
        validations: temporalValidations,
        overallTemporalScore: temporalScore,
        temporalWarnings: temporalValidations.filter(v => !v.isValid).map(v => v.reasoning)
      },
      metadata: {
        ...baseReport.metadata,
        methodUsed: 'comprehensive',
        method_used: 'comprehensive',
        apisUsed: [...(baseReport.metadata.apisUsed || []), 'source-credibility', 'temporal-context', 'media-verification'],
        warnings: [
          ...(baseReport.metadata.warnings || []),
          ...sourceCredibilityReport.biasWarnings,
          ...temporalValidations.filter(v => !v.isValid).map(v => `Temporal: ${v.reasoning}`)
        ]
      }
    };
  }

  private async runTemporalVerification(text: string): Promise<FactCheckReport> {
    console.log('⏰ Running Temporal Verification...');
    const temporalValidations = this.temporalService.evaluateTemporalClaims(text);
    const baseReport = await this.citationService.performCitationAugmentedAnalysis(text);
    const recentNewsScore = await this.calculateRecentNewsScore(text, temporalValidations);
    const temporalScore = temporalValidations.filter(v => v.isValid).length / Math.max(temporalValidations.length, 1) * 100;
    const finalScore = Math.round(((baseReport.final_score ?? 0) * 0.4) + (temporalScore * 0.4) + (recentNewsScore * 0.2));
    const sourceCredibilityReport = await this.generateBasicSourceCredibilityReport(baseReport.evidence);
    const categoryRating = this.ratingService.convertScoreToCategory(
      finalScore,
      sourceCredibilityReport.overallScore,
      baseReport.evidence.length
    );

    return {
      ...baseReport,
      finalScore: finalScore,
      final_score: finalScore,
      finalVerdict: temporalValidations.every(v => v.isValid) ? 'TRUE' : 'FALSE',
      final_verdict: temporalValidations.every(v => v.isValid) ? 'TRUE' : 'FALSE',
      categoryRating: categoryRating,
      category_rating: categoryRating,
      sourceCredibilityReport: sourceCredibilityReport,
      source_credibility_report: sourceCredibilityReport,
      temporalVerification: {
        hasTemporalClaims: temporalValidations.length > 0,
        validations: temporalValidations,
        overallTemporalScore: temporalScore,
        temporalWarnings: temporalValidations.filter(v => !v.isValid).map(v => v.reasoning),
        timelineAnalysis: await this.generateTimelineAnalysis(text, temporalValidations)
      },
      temporal_verification: {
        hasTemporalClaims: temporalValidations.length > 0,
        validations: temporalValidations,
        overallTemporalScore: temporalScore,
        temporalWarnings: temporalValidations.filter(v => !v.isValid).map(v => v.reasoning),
        timelineAnalysis: await this.generateTimelineAnalysis(text, temporalValidations)
      },
      metadata: {
        ...baseReport.metadata,
        methodUsed: 'temporal-verification',
        method_used: 'temporal-verification',
        apisUsed: [...(baseReport.metadata.apisUsed || []), 'temporal-context', 'recent-news'],
        warnings: [
          ...(baseReport.metadata.warnings || []),
          ...temporalValidations.filter(v => !v.isValid).map(v => `Temporal: ${v.reasoning}`)
        ]
      }
    };
  }

  private async generateSourceCredibilityReport(evidence: EvidenceItem[]): Promise<SourceCredibilityReport> {
    const sourceAnalyses = await Promise.all(
      evidence.map(e => e.url ? this.credibilityService.analyzeSource(e.url) : null)
    );
    const validSources = sourceAnalyses.filter((s): s is NonNullable<typeof s> => s !== null);
    const overallScore = this.credibilityService.calculateWeightedScore(evidence);
    const biasWarnings = this.credibilityService.getBiasWarnings(evidence.map(e => ({ url: e.url })));
    const credibilityBreakdown = {
      academic: validSources.filter(s => s.category === 'academic').length,
      news: validSources.filter(s => s.category === 'news').length,
      government: validSources.filter(s => s.category === 'government').length,
      social: validSources.filter(s => s.category === 'social').length
    };
    return {
      overallScore,
      highCredibilitySources: validSources.filter(s => s.credibilityScore >= 85).length,
      flaggedSources: validSources.filter(s => s.verificationStatus === 'flagged').length,
      biasWarnings,
      credibilityBreakdown
    };
  }

  private async generateBasicSourceCredibilityReport(evidence: EvidenceItem[]): Promise<SourceCredibilityReport> {
    const overallScore = this.credibilityService.calculateWeightedScore(evidence);
    return {
      overallScore,
      highCredibilitySources: evidence.filter(e => (e.score ?? 0) >= 85).length,
      flaggedSources: 0,
      biasWarnings: [],
      credibilityBreakdown: { academic: 0, news: evidence.length, government: 0, social: 0 }
    };
  }

  private async generateMediaVerificationReport(text: string): Promise<MediaVerificationReport> {
    return { hasVisualContent: false, reverseImageResults: [] };
  }

  private calculateComprehensiveScore(baseScore: number, credibilityScore: number, temporalScore: number, mediaReport: MediaVerificationReport): number {
    return Math.round((baseScore * 0.5) + (credibilityScore * 0.3) + (temporalScore * 0.2));
  }

  private async calculateRecentNewsScore(text: string, temporalValidations: TemporalValidation[]): Promise<number> {
    if (temporalValidations.length === 0) return 70;
    const recentValidations = temporalValidations.filter(v => v.dateType === 'present' || v.dateType === 'near_future');
    return recentValidations.length > 0 ? 85 : 60;
  }

  private async generateTimelineAnalysis(text: string, validations: TemporalValidation[]): Promise<{ events: TimelineEvent[], consistency: number }> {
    return {
      events: [],
      consistency: validations.filter(v => v.isValid).length / Math.max(validations.length, 1) * 100
    };
  }

  private generateErrorReport(text: string, method: FactCheckMethod, error: any, processingTime: number): FactCheckReport {
    const defaultScoreBreakdown: ScoreBreakdown = {
        metrics: [],
        finalScoreFormula: ""
    };

    return {
      id: `error-${Date.now()}`,
      originalText: text,
      finalVerdict: 'Error',
      final_verdict: 'Error',
      finalScore: 0,
      final_score: 0,
      reasoning: `Error during ${method} analysis: ${error instanceof Error ? error.message : 'Unknown error'}`,
      evidence: [],
      claimVerifications: [],
      enhancedClaimText: text,
      enhanced_claim_text: text,
      sourceCredibilityReport: {
        overallScore: 0,
        highCredibilitySources: 0,
        flaggedSources: 0,
        biasWarnings: [],
        credibilityBreakdown: { academic: 0, news: 0, government: 0, social: 0 }
      },
      source_credibility_report: {
        overallScore: 0,
        highCredibilitySources: 0,
        flaggedSources: 0,
        biasWarnings: [],
        credibilityBreakdown: { academic: 0, news: 0, government: 0, social: 0 }
      },
      temporalVerification: {
        hasTemporalClaims: false,
        validations: [],
        overallTemporalScore: 0,
        temporalWarnings: []
      },
      temporal_verification: {
        hasTemporalClaims: false,
        validations: [],
        overallTemporalScore: 0,
        temporalWarnings: []
      },
      metadata: {
        methodUsed: method,
        method_used: method,
        processingTimeMs: processingTime,
        processing_time_ms: processingTime,
        apisUsed: ['error-handling'],
        sourcesConsulted: { total: 0, highCredibility: 0, conflicting: 0 },
        sources_consulted: { total: 0, high_credibility: 0, highCredibility: 0, conflicting: 0 },
        warnings: [`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      },
      scoreBreakdown: defaultScoreBreakdown,
      score_breakdown: defaultScoreBreakdown,
    };
  }
}

const enhancedFactCheckService = new EnhancedFactCheckService();

export const enhancedFactCheck = (
  text: string,
  method: FactCheckMethod = 'COMPREHENSIVE',
): Promise<FactCheckReport> => {
  return enhancedFactCheckService.orchestrateFactCheck(text, method);
};
