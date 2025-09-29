import { FactCheckReport, FactCheckMethod, SourceCredibilityReport, MediaVerificationReport, EvidenceItem, UserCategory, TimelineEvent, TemporalValidation, CategoryRating } from '../types/factCheck';
import { CitationAugmentedService } from './analysis/CitationAugmentedService';
import { TemporalContextService } from './core/TemporalContextService';
import { SourceCredibilityService } from './core/SourceCredibilityService';
import { CategoryRatingService } from './core/CategoryRatingService';
import { generateSHA256 } from '../utils/hashUtils'; // ADD this import
import { getCache, setCache } from './caching';      // ADD this import
import { runPhase2WebSearch } from './factCheckSearch'; // NEW import for Phase 2
import { runPhase3TemporalAnalysis } from './newsDataService'; // NEW import for Phase 3

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

  private async _runPhase2(text: string): Promise<{ baseReport: FactCheckReport, aiOverview: string }> {
    console.log('Phase 2: Running Enhanced Web Search (Parallel SERP/Google + Cache)');

    const { serpResults, googleGroundingResults, aiOverview } = await runPhase2WebSearch(text);

    // Combine all unique results from SERP and Google Custom Search for CitationAugmentedService
    const allSearchResults = [
        ...serpResults.map((r: any) => ({ link: r.link, snippet: r.snippet, source: r.source || r.domain })),
        ...googleGroundingResults.map((r: any) => ({ link: r.link, snippet: r.snippet, source: r.displayLink })),
    ].filter((result, index, self) =>
        index === self.findIndex((r: any) => r.link === result.link)
    );

    if (allSearchResults.length === 0) {
        // Return minimal report if no evidence is found
        throw new Error('No substantial evidence found via web search.');
    }

    const baseReport = await this.citationService.processSearchResults(text, allSearchResults);

    // Integrate AI Overview into reasoning
    if (aiOverview) {
        baseReport.reasoning = `AI Overview: ${aiOverview}. ${baseReport.reasoning}`;
        baseReport.metadata.apis_used.push('serp-ai-overview');
    }

    // If results indicate a clear verdict (e.g., all sources agree), skip to synthesis.
    // Assuming score > 90 and high source count means high confidence.
    if (baseReport.final_score >= 90 && baseReport.evidence.length >= 5 && baseReport.source_credibility_report?.flaggedSources === 0) {
         baseReport.metadata.warnings.push('Analysis was fast-tracked due to strong initial consensus.');
    }

    return { baseReport, aiOverview };
}


// 3. NEW Helper: _runPhase3 for Specialized/Temporal Analysis
private async _runPhase3(text: string, baseReport: FactCheckReport): Promise<{ temporalValidations: TemporalValidation[], recentNewsScore: number }> {
    console.log('Phase 3: Specialized & Temporal Analysis (NewsData.io)');
    const claimHash = await generateSHA256(text);

    // a. Trigger only if Text Analysis Service detects dates/events (relying on TemporalContextService)
    const temporalValidations = this.temporalService.evaluateTemporalClaims(text);

    // Check if temporal analysis is warranted
    if (temporalValidations.length === 0) {
        return { temporalValidations: baseReport.temporal_verification?.validations || [], recentNewsScore: 70 }; // Neutral score
    }

    // Use the earliest detected date for the cache key and search range
    const relevantDates = temporalValidations.filter(v => v.date).map(v => v.date);
    const dateForSearch = relevantDates.length > 0 ? new Date(relevantDates[0]!) : new Date();

    const fromDate = new Date(dateForSearch);
    fromDate.setDate(dateForSearch.getDate() - 3); // ±3-day window
    const toDate = new Date(dateForSearch);
    toDate.setDate(dateForSearch.getDate() + 3);

    const fromDateStr = fromDate.toISOString().split('T')[0];
    const toDateStr = toDate.toISOString().split('T')[0];

    const cacheKey = `temporal_${claimHash}_${fromDateStr}`;
    // Check cache (key: temporal${claimHash}_${date})
    const cached = await getCache(cacheKey);

    if (cached) {
        return cached as { temporalValidations: TemporalValidation[], recentNewsScore: number };
    }

    // b. API: newsdata.io API. Use from_date/to_date with a ±3-day window for accuracy. Limit to 20 articles.
    const newsDataResults = await runPhase3TemporalAnalysis(
        baseReport.originalText,
        fromDateStr,
        toDateStr,
        20 // Limit to 20 articles
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

// 4. Implement a placeholder for processing news results
private processNewsDataResults(newsArticles: any[], baseReport: FactCheckReport): number {
    // Simple placeholder logic: requires LLM/Gemini call in a real scenario
    if (newsArticles.length === 0) return 70; // Neutral if no recent news

    const matches = newsArticles.filter((article: any) =>
        article.title.toLowerCase().includes(baseReport.originalText.toLowerCase().substring(0, 10)) ||
        article.snippet?.toLowerCase().includes(baseReport.originalText.toLowerCase().substring(0, 10))
    );

    return Math.min(95, 50 + (matches.length * 2.5)); // Min 50, +2.5 points per matching article
}


  private async runComprehensiveAnalysis(text: string): Promise<FactCheckReport> {
    const startTime = Date.now();
    try {
        // Phase 2: Broad Web Search & Initial Grounding
        const { baseReport, aiOverview } = await this._runPhase2(text);

        // If Phase 2 hit a clear consensus (early exit flag set in _runPhase2)
        if (baseReport.metadata.warnings.includes('Analysis was fast-tracked due to strong initial consensus.')) {
            baseReport.metadata.processing_time_ms = Date.now() - startTime;
            return baseReport;
        }

        // Phase 3: Specialized & Temporal Analysis (conditional)
        const { temporalValidations, recentNewsScore } = await this._runPhase3(text, baseReport);

        // 4. Enhanced source credibility analysis (using evidence from Phase 2)
        const sourceCredibilityReport = await this.generateSourceCredibilityReport(baseReport.evidence);

        // 5. Combine scores
        const temporalScore = temporalValidations.filter(v => v.isValid).length / Math.max(temporalValidations.length, 1) * 100;

        // 6. Media verification (placeholder)
        const mediaVerificationReport = await this.generateMediaVerificationReport(text);

        // 7. Calculate final weighted score
        const finalScore = this.calculateComprehensiveScore(
            baseReport.final_score,
            sourceCredibilityReport.overallScore,
            temporalScore,
            mediaVerificationReport,
            recentNewsScore // Include Phase 3 News Score
        );

        // 8. Generate category rating
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
                     { name: 'Source Credibility', score: sourceCredibilityReport.overallScore, description: 'Source reliability weighted average.' },
                     { name: 'Temporal Accuracy', score: temporalScore, description: 'Accuracy of time-based references.' },
                     { name: 'Recent News Corroboration', score: recentNewsScore, description: 'Alignment with recent news via newsdata.io.' }
                 ]
             }
        };
    } catch (error) {
        return this.generateErrorReport(text, 'comprehensive', error, Date.now() - startTime);
    }
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
    mediaReport: MediaVerificationReport,
    recentNewsScore: number // NEW parameter
): number {
    // Weighted scoring: Base Search (40%) + Credibility (30%) + Temporal Validation (20%) + Recent News (10%)
    return Math.round((baseScore * 0.4) + (credibilityScore * 0.3) + (temporalScore * 0.2) + (recentNewsScore * 0.1));
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