import { FactCheckReport, FactCheckMethod, SourceCredibilityReport, MediaVerificationReport, EvidenceItem, UserCategory, TimelineEvent, TemporalValidation, CategoryRating } from '../types/factCheck';
import { CitationAugmentedService } from './analysis/CitationAugmentedService';
import { TemporalContextService } from './core/TemporalContextService';
import { SourceCredibilityService } from './core/SourceCredibilityService';
import { CategoryRatingService } from './core/CategoryRatingService';
import { generateSHA256 } from '../utils/hashUtils';
import { getCache, setCache } from './caching';
import { FactCheckSearchService } from './factCheckSearchService'; // NEW import
import { NewsDataService } from './newsDataService'; // NEW import

export class EnhancedFactCheckService {
  private citationService: CitationAugmentedService;
  private temporalService: TemporalContextService;
  private credibilityService: SourceCredibilityService;
  private ratingService: CategoryRatingService;
  private factCheckSearchService: FactCheckSearchService; // NEW service instance
  private newsDataService: NewsDataService; // NEW service instance

  constructor() {
    this.citationService = new CitationAugmentedService();
    this.temporalService = TemporalContextService.getInstance();
    this.credibilityService = SourceCredibilityService.getInstance();
    this.ratingService = CategoryRatingService.getInstance();
    this.factCheckSearchService = FactCheckSearchService.getInstance(); // NEW
    this.newsDataService = NewsDataService.getInstance(); // NEW
  }

  async orchestrateFactCheck(text: string, method: FactCheckMethod): Promise<FactCheckReport> {
    const startTime = Date.now();

    try {
      switch (method) {
        case 'comprehensive':
          return await this.runComprehensiveAnalysis(text);
        case 'temporal-verification':
          // This method is not being refactored, but it's kept for completeness.
          return await this.runTemporalVerification(text);
        default:
          return await this.runComprehensiveAnalysis(text);
      }
    } catch (error) {
      return this.generateErrorReport(text, method, error, Date.now() - startTime);
    }
  }

  private async _runPhase2(text: string): Promise<{ baseReport: FactCheckReport, aiOverview: string }> {
    console.log('Phase 2: Running Enhanced Web Search (Parallel SERP/Google + Cache)');

    const { serpResults, googleGroundingResults, aiOverview } = await this.factCheckSearchService.runPhase2WebSearch(text);

    const allSearchResults = [
        ...serpResults.map((r: any) => ({ link: r.link, snippet: r.snippet, source: r.source || r.domain })),
        ...googleGroundingResults.map((r: any) => ({ link: r.link, snippet: r.snippet, source: r.displayLink })),
    ].filter((result, index, self) =>
        index === self.findIndex((r: any) => r.link === result.link)
    );

    if (allSearchResults.length === 0) {
        throw new Error('No substantial evidence found via web search.');
    }

    const baseReport = await this.citationService.processSearchResults(text, allSearchResults);

    if (aiOverview) {
        baseReport.reasoning = `AI Overview: ${aiOverview}. ${baseReport.reasoning}`;
        baseReport.metadata.apis_used.push('serp-ai-overview');
    }

    if (baseReport.final_score >= 90 && baseReport.evidence.length >= 5 && (baseReport.source_credibility_report?.flaggedSources ?? 0) === 0) {
         baseReport.metadata.warnings.push('Analysis was fast-tracked due to strong initial consensus.');
    }

    return { baseReport, aiOverview };
  }

  private async _runPhase3(text: string, baseReport: FactCheckReport): Promise<{ temporalValidations: TemporalValidation[], recentNewsScore: number }> {
    console.log('Phase 3: Specialized & Temporal Analysis (NewsData.io)');
    const claimHash = await generateSHA256(text);

    const temporalValidations = this.temporalService.evaluateTemporalClaims(text);

    if (temporalValidations.length === 0) {
        return { temporalValidations: baseReport.temporal_verification?.validations || [], recentNewsScore: 70 };
    }

    const relevantDates = temporalValidations.filter(v => v.date).map(v => v.date);
    const dateForSearch = relevantDates.length > 0 ? new Date(relevantDates[0]!) : new Date();

    const fromDate = new Date(dateForSearch);
    fromDate.setDate(dateForSearch.getDate() - 3);
    const toDate = new Date(dateForSearch);
    toDate.setDate(dateForSearch.getDate() + 3);

    const fromDateStr = fromDate.toISOString().split('T')[0];
    const toDateStr = toDate.toISOString().split('T')[0];

    const cacheKey = `temporal_${claimHash}_${fromDateStr}`;
    const cached = await getCache(cacheKey);

    if (cached) {
        return cached as { temporalValidations: TemporalValidation[], recentNewsScore: number };
    }

    const newsDataResults = await this.newsDataService.runPhase3TemporalAnalysis(
        baseReport.originalText,
        fromDateStr,
        toDateStr,
        20
    );

    const newsArticles = newsDataResults?.results || [];
    const recentNewsScore = this.processNewsDataResults(newsArticles, baseReport);

    const result = {
        temporalValidations,
        recentNewsScore
    };

    await setCache(cacheKey, result, 60 * 60 * 24);
    return result;
  }

  private processNewsDataResults(newsArticles: any[], baseReport: FactCheckReport): number {
    if (newsArticles.length === 0) return 70;

    const matches = newsArticles.filter((article: any) =>
        article.title.toLowerCase().includes(baseReport.originalText.toLowerCase().substring(0, 10)) ||
        (article.snippet || '').toLowerCase().includes(baseReport.originalText.toLowerCase().substring(0, 10))
    );

    return Math.min(95, 50 + (matches.length * 2.5));
  }

  private async runComprehensiveAnalysis(text: string): Promise<FactCheckReport> {
    const startTime = Date.now();
    try {
        const { baseReport, aiOverview } = await this._runPhase2(text);

        if (baseReport.metadata.warnings.includes('Analysis was fast-tracked due to strong initial consensus.')) {
            baseReport.metadata.processing_time_ms = Date.now() - startTime;
            return baseReport;
        }

        const { temporalValidations, recentNewsScore } = await this._runPhase3(text, baseReport);
        const sourceCredibilityReport = await this.generateSourceCredibilityReport(baseReport.evidence);
        const temporalScore = temporalValidations.filter(v => v.isValid).length / Math.max(temporalValidations.length, 1) * 100;
        const mediaVerificationReport = await this.generateMediaVerificationReport(text);

        const finalScore = this.calculateComprehensiveScore(
            baseReport.final_score,
            sourceCredibilityReport.overallScore,
            temporalScore,
            mediaVerificationReport,
            recentNewsScore
        );

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
                processing_time_ms: Date.now() - startTime,
                apis_used: [...baseReport.metadata.apis_used, 'serp-api', 'newsdata-io'],
                warnings: [
                    ...baseReport.metadata.warnings,
                    ...sourceCredibilityReport.biasWarnings,
                    ...temporalValidations.filter(v => !v.isValid).map(v => `Temporal: ${v.reasoning}`)
                ]
            },
             score_breakdown: {
                 ...baseReport.score_breakdown,
                 final_score_formula: 'Base Search (40%) + Credibility (30%) + Temporal Accuracy (20%) + Recent News (10%)',
                 metrics: [
                     ...(baseReport.score_breakdown?.metrics || []),
                     { name: 'Source Reliability', score: sourceCredibilityReport.overallScore, description: 'Source reliability weighted average.' },
                     { name: 'Temporal Accuracy', score: temporalScore, description: 'Accuracy of time-based references.' },
                     { name: 'Recent News Corroboration', score: recentNewsScore, description: 'Alignment with recent news via newsdata.io.' }
                 ]
             }
        };
    } catch (error) {
        return this.generateErrorReport(text, 'comprehensive', error, Date.now() - startTime);
    }
  }

  private calculateComprehensiveScore(
    baseScore: number,
    credibilityScore: number,
    temporalScore: number,
    mediaReport: MediaVerificationReport,
    recentNewsScore: number
  ): number {
    return Math.round((baseScore * 0.4) + (credibilityScore * 0.3) + (temporalScore * 0.2) + (recentNewsScore * 0.1));
  }

  // --- Existing Helper and Placeholder Methods (kept for completeness) ---

  private async runTemporalVerification(text: string): Promise<FactCheckReport> {
    console.log('⏰ Running Temporal Verification...');
    const temporalValidations = this.temporalService.evaluateTemporalClaims(text);
    const baseReport = await this.citationService.performCitationAugmentedAnalysis(text);
    const recentNewsScore = await this.calculateRecentNewsScore(text, temporalValidations);
    const temporalScore = temporalValidations.filter(v => v.isValid).length / Math.max(temporalValidations.length, 1) * 100;
    const finalScore = Math.round((baseReport.final_score * 0.4) + (temporalScore * 0.4) + (recentNewsScore * 0.2));
    const sourceCredibilityReport = await this.generateBasicSourceCredibilityReport(baseReport.evidence);
    const categoryRating = this.ratingService.convertScoreToCategory(finalScore, sourceCredibilityReport.overallScore, baseReport.evidence.length);
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
        warnings: [...baseReport.metadata.warnings, ...temporalValidations.filter(v => !v.isValid).map(v => `Temporal: ${v.reasoning}`)]
      }
    };
  }

  private async generateSourceCredibilityReport(evidence: EvidenceItem[]): Promise<SourceCredibilityReport> {
    const sourceAnalyses = await Promise.all(evidence.map(e => e.url ? this.credibilityService.analyzeSource(e.url) : null));
    const validSources = sourceAnalyses.filter((s): s is NonNullable<typeof s> => s !== null);
    const overallScore = this.credibilityService.calculateWeightedScore(evidence);
    const biasWarnings = this.credibilityService.getBiasWarnings(evidence.map(e => ({ url: e.url })));
    const credibilityBreakdown = {
      academic: validSources.filter(s => s.category === 'academic').length,
      news: validSources.filter(s => s.category === 'news').length,
      government: validSources.filter(s => s.category === 'government').length,
      social: validSources.filter(s => s.category === 'social').length
    };
    return { overallScore, highCredibilitySources: validSources.filter(s => s.credibilityScore >= 85).length, flaggedSources: validSources.filter(s => s.verificationStatus === 'flagged').length, biasWarnings, credibilityBreakdown };
  }

  private async generateBasicSourceCredibilityReport(evidence: EvidenceItem[]): Promise<SourceCredibilityReport> {
    const overallScore = this.credibilityService.calculateWeightedScore(evidence);
    return { overallScore, highCredibilitySources: evidence.filter(e => e.score >= 85).length, flaggedSources: 0, biasWarnings: [], credibilityBreakdown: { academic: 0, news: evidence.length, government: 0, social: 0 }};
  }

  private async generateMediaVerificationReport(text: string): Promise<MediaVerificationReport> {
    return { hasVisualContent: false, reverseImageResults: [] };
  }

  private async calculateRecentNewsScore(text: string, temporalValidations: TemporalValidation[]): Promise<number> {
    if (temporalValidations.length === 0) return 70;
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
    return { events: [], consistency: validations.filter(v => v.isValid).length / Math.max(validations.length, 1) * 100 };
  }

  private generateUserCategoryRecommendations(score: number, credibilityReport: SourceCredibilityReport): { category: UserCategory, suitabilityScore: number, reasoning: string }[] {
    const recommendations: { category: UserCategory, suitabilityScore: number, reasoning: string }[] = [];
    recommendations.push({ category: 'journalist', suitabilityScore: credibilityReport.highCredibilitySources >= 3 ? 95 : 75, reasoning: credibilityReport.highCredibilitySources >= 3 ? 'High-quality sources suitable for professional journalism' : 'Adequate sources but may need additional verification' });
    recommendations.push({ category: 'researcher', suitabilityScore: credibilityReport.credibilityBreakdown.academic > 0 ? 90 : 70, reasoning: credibilityReport.credibilityBreakdown.academic > 0 ? 'Contains academic sources suitable for research' : 'Limited academic sources - consider additional peer-reviewed references' });
    return recommendations;
  }

  private generateErrorReport(text: string, method: FactCheckMethod, error: any, processingTime: number): FactCheckReport {
    return {
      id: `error-${Date.now()}`,
      originalText: text,
      final_verdict: 'Analysis failed due to technical error',
      final_score: 0,
      reasoning: `Error during ${method} analysis: ${error instanceof Error ? error.message : 'Unknown error'}`,
      evidence: [],
      enhanced_claim_text: text,
      source_credibility_report: { overallScore: 0, highCredibilitySources: 0, flaggedSources: 0, biasWarnings: [], credibilityBreakdown: { academic: 0, news: 0, government: 0, social: 0 }},
      temporal_verification: { hasTemporalClaims: false, validations: [], overallTemporalScore: 0, temporalWarnings: [] },
      user_category_recommendations: [],
      metadata: { method_used: method, processing_time_ms: processingTime, apis_used: ['error-handling'], sources_consulted: { total: 0, high_credibility: 0, conflicting: 0 }, warnings: [`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`] },
      score_breakdown: { final_score_formula: 'Error - unable to calculate', metrics: [] }
    };
  }
}