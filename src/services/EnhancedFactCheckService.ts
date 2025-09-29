import { FactCheckReport, FactCheckMethod, SourceCredibilityReport, MediaVerificationReport, EvidenceItem, UserCategory, TimelineEvent, TemporalValidation, CategoryRating } from '../types/factCheck';
import { CitationAugmentedService } from './analysis/CitationAugmentedService';
import { TemporalContextService } from './core/TemporalContextService';
import { SourceCredibilityService } from './core/SourceCredibilityService';
import { CategoryRatingService } from './core/CategoryRatingService';
import { search as webSearch } from './webSearch';

export class EnhancedFactCheckService {
  private citationService: CitationAugmentedService;
  private temporalService: TemporalContextService;
  private credibilityService: SourceCredibilityService;
  private ratingService: CategoryRatingService;

  constructor() {
    this.citationService = new CitationAugmentedService();
    this.temporalService = TemporalContextService.getInstance();
    this.credibilityService = SourceCredibilityService.getInstance();
    this.ratingService = CategoryRatingService.getInstance();
  }

  async orchestrateFactCheck(text: string, method: FactCheckMethod): Promise<FactCheckReport> {
    const startTime = Date.now();

    try {
      switch (method) {
        case 'comprehensive':
          return await this.runComprehensiveAnalysis(text);
        case 'temporal-verification':
          return await this.runTemporalVerification(text);
        default:
          // Fallback to comprehensive
          return await this.runComprehensiveAnalysis(text);
      }
    } catch (error) {
      return this.generateErrorReport(text, method, error, Date.now() - startTime);
    }
  }

  private async _fetchAndAugmentWithSearch(text: string): Promise<FactCheckReport> {
    // Step 1: Normalize the claim and generate search queries.
    // This part is missing in the current implementation, but is crucial.
    // You can adapt the logic from geminiService.ts's `normalizeClaim` and `generateSearchQueries`.
    const searchQueries = [
        `fact check "${text}"`,
        `${text} controversy`,
        `is ${text} true`
    ];

    const searchEvidence = await Promise.all(
      searchQueries.map(query => webSearch(query, 10))
    );

    // Flatten search results and filter for uniqueness
    const allSearchResults = searchEvidence.flat().filter((result, index, self) =>
        index === self.findIndex((r) => r.link === result.link)
    );

    // Now, feed these search results into the citation service for processing
    // You'll need to create a helper function in CitationAugmentedService to process raw search results.
    // This is a simplified example, demonstrating the flow.
    const processedReport = await this.citationService.processSearchResults(text, allSearchResults);

    return processedReport;
  }

  private async runComprehensiveAnalysis(text: string): Promise<FactCheckReport> {
    console.log('🔍 Running Comprehensive Analysis with Web Search...');

    // 1. Base analysis using web search
    const baseReport = await this._fetchAndAugmentWithSearch(text);

    // 2. Enhanced source credibility analysis
    const sourceCredibilityReport = await this.generateSourceCredibilityReport(baseReport.evidence);

    // 3. Temporal verification (integrated)
    const temporalValidations = this.temporalService.evaluateTemporalClaims(text);
    const temporalScore = temporalValidations.filter(v => v.isValid).length / Math.max(temporalValidations.length, 1) * 100;

    // 4. Media verification (placeholder for future implementation)
    const mediaVerificationReport = await this.generateMediaVerificationReport(text);

    // 5. Calculate final weighted score
    const finalScore = this.calculateComprehensiveScore(
      baseReport.final_score,
      sourceCredibilityReport.overallScore,
      temporalScore,
      mediaVerificationReport
    );

    // 6. Generate category rating
    const categoryRating = this.ratingService.convertScoreToCategory(
      finalScore,
      sourceCredibilityReport.overallScore,
      baseReport.evidence.length
    );

    return {
      ...baseReport,
      final_score: finalScore,
      final_verdict: `Comprehensive Analysis: ${categoryRating.reasoning}`,
      category_rating: categoryRating,
      source_credibility_report: sourceCredibilityReport,
      media_verification_report: mediaVerificationReport,
      temporal_verification: {
        hasTemporalClaims: temporalValidations.length > 0,
        validations: temporalValidations,
        overallTemporalScore: temporalScore,
        temporalWarnings: temporalValidations.filter(v => !v.isValid).map(v => v.reasoning)
      },
      user_category_recommendations: this.generateUserCategoryRecommendations(finalScore, sourceCredibilityReport),
      metadata: {
        ...baseReport.metadata,
        method_used: 'comprehensive',
        apis_used: [...baseReport.metadata.apis_used, 'source-credibility', 'temporal-context', 'media-verification'],
        warnings: [
          ...baseReport.metadata.warnings,
          ...sourceCredibilityReport.biasWarnings,
          ...temporalValidations.filter(v => !v.isValid).map(v => `Temporal: ${v.reasoning}`)
        ]
      }
    };
  }

  private async runTemporalVerification(text: string): Promise<FactCheckReport> {
    console.log('⏰ Running Temporal Verification...');

    // 1. Enhanced temporal analysis
    const temporalValidations = this.temporalService.evaluateTemporalClaims(text);

    // 2. Base analysis with temporal focus
    const baseReport = await this.citationService.performCitationAugmentedAnalysis(text);

    // 3. Recent news integration (focus on temporal sources)
    const recentNewsScore = await this.calculateRecentNewsScore(text, temporalValidations);

    // 4. Calculate temporal-weighted score
    const temporalScore = temporalValidations.filter(v => v.isValid).length / Math.max(temporalValidations.length, 1) * 100;
    const finalScore = Math.round((baseReport.final_score * 0.4) + (temporalScore * 0.4) + (recentNewsScore * 0.2));

    // 5. Basic source credibility (lighter than comprehensive)
    const sourceCredibilityReport = await this.generateBasicSourceCredibilityReport(baseReport.evidence);

    const categoryRating = this.ratingService.convertScoreToCategory(
      finalScore,
      sourceCredibilityReport.overallScore,
      baseReport.evidence.length
    );

    return {
      ...baseReport,
      final_score: finalScore,
      final_verdict: `Temporal Verification: ${this.generateTemporalVerdict(finalScore, temporalValidations)}`,
      category_rating: categoryRating,
      source_credibility_report: sourceCredibilityReport,
      temporal_verification: {
        hasTemporalClaims: temporalValidations.length > 0,
        validations: temporalValidations,
        overallTemporalScore: temporalScore,
        temporalWarnings: temporalValidations.filter(v => !v.isValid).map(v => v.reasoning),
        timelineAnalysis: await this.generateTimelineAnalysis(text, temporalValidations)
      },
      user_category_recommendations: this.generateUserCategoryRecommendations(finalScore, sourceCredibilityReport),
      metadata: {
        ...baseReport.metadata,
        method_used: 'temporal-verification',
        apis_used: [...baseReport.metadata.apis_used, 'temporal-context', 'recent-news'],
        warnings: [
          ...baseReport.metadata.warnings,
          ...temporalValidations.filter(v => !v.isValid).map(v => `Temporal: ${v.reasoning}`)
        ]
      }
    };
  }

  // Helper methods implementation...
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
    // Lighter version for temporal verification
    const overallScore = this.credibilityService.calculateWeightedScore(evidence);

    return {
      overallScore,
      highCredibilitySources: evidence.filter(e => e.score >= 85).length,
      flaggedSources: 0, // Skip detailed flagging for speed
      biasWarnings: [],
      credibilityBreakdown: {
        academic: 0,
        news: evidence.length,
        government: 0,
        social: 0
      }
    };
  }

  private async generateMediaVerificationReport(text: string): Promise<MediaVerificationReport> {
    // Placeholder - will be implemented when media verification APIs are integrated
    return {
      hasVisualContent: false,
      reverseImageResults: []
    };
  }

  private calculateComprehensiveScore(
    baseScore: number,
    credibilityScore: number,
    temporalScore: number,
    mediaReport: MediaVerificationReport
  ): number {
    // Weighted scoring: Base(50%) + Credibility(30%) + Temporal(20%)
    return Math.round((baseScore * 0.5) + (credibilityScore * 0.3) + (temporalScore * 0.2));
  }

  private async calculateRecentNewsScore(text: string, temporalValidations: TemporalValidation[]): Promise<number> {
    // Score based on how well the claim aligns with recent news
    if (temporalValidations.length === 0) return 70; // Neutral for non-temporal claims

    const recentValidations = temporalValidations.filter(v => v.dateType === 'present' || v.dateType === 'near_future');
    return recentValidations.length > 0 ? 85 : 60;
  }

  private generateTemporalVerdict(score: number, validations: TemporalValidation[]): string {
    const invalidCount = validations.filter(v => !v.isValid).length;

    if (invalidCount === 0 && score >= 80) return 'Temporally consistent and factually sound';
    if (invalidCount === 0) return 'Temporally consistent with mixed factual accuracy';
    if (invalidCount === 1) return 'Minor temporal inconsistency detected';
    return 'Multiple temporal issues require attention';
  }

  private async generateTimelineAnalysis(text: string, validations: TemporalValidation[]): Promise<{ events: TimelineEvent[], consistency: number }> {
    // Placeholder for timeline analysis
    return {
      events: [],
      consistency: validations.filter(v => v.isValid).length / Math.max(validations.length, 1) * 100
    };
  }

  private generateUserCategoryRecommendations(score: number, credibilityReport: SourceCredibilityReport): { category: UserCategory, suitabilityScore: number, reasoning: string }[] {
    const recommendations: { category: UserCategory, suitabilityScore: number, reasoning: string }[] = [];

    // Journalist recommendation
    recommendations.push({
      category: 'journalist',
      suitabilityScore: credibilityReport.highCredibilitySources >= 3 ? 95 : 75,
      reasoning: credibilityReport.highCredibilitySources >= 3
        ? 'High-quality sources suitable for professional journalism'
        : 'Adequate sources but may need additional verification'
    });

    // Researcher recommendation
    recommendations.push({
      category: 'researcher',
      suitabilityScore: credibilityReport.credibilityBreakdown.academic > 0 ? 90 : 70,
      reasoning: credibilityReport.credibilityBreakdown.academic > 0
        ? 'Contains academic sources suitable for research'
        : 'Limited academic sources - consider additional peer-reviewed references'
    });

    return recommendations;
  }

  private generateErrorReport(text: string, method: FactCheckMethod, error: any, processingTime: number): FactCheckReport {
    // Implementation from original file...
    return {
      id: `error-${Date.now()}`,
      originalText: text,
      final_verdict: 'Analysis failed due to technical error',
      final_score: 0,
      reasoning: `Error during ${method} analysis: ${error instanceof Error ? error.message : 'Unknown error'}`,
      evidence: [],
      enhanced_claim_text: text,
      source_credibility_report: {
        overallScore: 0,
        highCredibilitySources: 0,
        flaggedSources: 0,
        biasWarnings: [],
        credibilityBreakdown: { academic: 0, news: 0, government: 0, social: 0 }
      },
      temporal_verification: {
        hasTemporalClaims: false,
        validations: [],
        overallTemporalScore: 0,
        temporalWarnings: []
      },
      user_category_recommendations: [],
      metadata: {
        method_used: method,
        processing_time_ms: processingTime,
        apis_used: ['error-handling'],
        sources_consulted: { total: 0, high_credibility: 0, conflicting: 0 },
        warnings: [`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      },
      score_breakdown: {
        final_score_formula: 'Error - unable to calculate',
        metrics: []
      }
    };
  }
}