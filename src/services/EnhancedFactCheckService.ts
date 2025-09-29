// File: src/services/EnhancedFactCheckService.ts (UPDATED)
// IMPLEMENTATION GUIDE:
//
// 1. ENSURE ALL API KEYS ARE SET IN SETTINGS:
//    - Gemini API Key (gemini_api_key)
//    - Google Search API Key (search_api_key)
//    - Google Search ID (search_id)
//    - SERP API Key (serp_api_key)
//    - NewsData.io API Key (newsdata_api_key)
//    - Google Fact Check API Key (fact_check_api_key)
//
// 2. ALL APIS ARE FRONT-FACING (user's keys, no server-side storage except Vercel Blob)
//
// 3. CACHING STRATEGY:
//    - Web search results: 1 hour (webSearchTTL)
//    - Temporal analysis: 12 hours (temporalTTL)
//    - Fact check results: 24 hours (factCheckTTL)
//    - All cached to localStorage with fallback
//
// 4. PROCESSING PHASES:
//    - Phase 1: Text analysis (detect dates, events, statistics)
//    - Phase 2: Broad web search (SERP + Google + Fact Check APIs in parallel)
//    - Phase 3: Temporal analysis (NewsData API if dates detected)
//    - Phase 4: Citation processing & scoring
//    - Phase 5: Final report generation
//
// 5. ERROR HANDLING:
//    - All API calls wrapped in try-catch
//    - Graceful degradation if APIs fail
//    - Always returns a valid FactCheckReport
//

import { FactCheckReport, FactCheckMethod, SourceCredibilityReport, MediaVerificationReport, EvidenceItem, TemporalValidation } from '../types/factCheck';
import { CitationAugmentedService } from './analysis/CitationAugmentedService';
import { TemporalContextService } from './core/TemporalContextService';
import { SourceCredibilityService } from './core/SourceCredibilityService';
import { CategoryRatingService } from './core/CategoryRatingService';
import { SerpApiService } from './serpApiService';
import { NewsDataService } from './newsDataService';
import { GoogleFactCheckService } from './googleFactCheckService';
import { AdvancedCacheService } from './advancedCacheService';
import { generateSHA256 } from '../utils/hashUtils';
import { search as googleSearch } from './webSearch';

export class EnhancedFactCheckService {
  private citationService: CitationAugmentedService;
  private temporalService: TemporalContextService;
  private credibilityService: SourceCredibilityService;
  private ratingService: CategoryRatingService;
  private serpApi: SerpApiService;
  private newsDataApi: NewsDataService;
  private factCheckApi: GoogleFactCheckService;
  private cache: AdvancedCacheService;

  constructor() {
    this.citationService = new CitationAugmentedService();
    this.temporalService = TemporalContextService.getInstance();
    this.credibilityService = SourceCredibilityService.getInstance();
    this.ratingService = CategoryRatingService.getInstance();
    this.serpApi = SerpApiService.getInstance();
    this.newsDataApi = NewsDataService.getInstance();
    this.factCheckApi = GoogleFactCheckService.getInstance();
    this.cache = AdvancedCacheService.getInstance();
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
          return await this.runComprehensiveAnalysis(text);
      }
    } catch (error) {
      return this.generateErrorReport(text, method, error, Date.now() - startTime);
    }
  }

  /**
   * PHASE 1: Text Analysis & Claim Detection
   */
  private async analyzeTextStructure(text: string): Promise<{
    hasDates: boolean;
    hasEvents: boolean;
    hasStatistics: boolean;
    detectedDates: string[];
    keywords: string[];
  }> {
    const datePatterns = [
      /\b\d{4}\b/g,                    // Year
      /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi,
      /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, // Date formats
      /\b(?:today|yesterday|last week|this month)\b/gi
    ];

    const detectedDates: string[] = [];
    let hasDates = false;

    for (const pattern of datePatterns) {
      const matches = text.match(pattern);
      if (matches) {
        hasDates = true;
        detectedDates.push(...matches);
      }
    }

    const hasEvents = /\b(?:happened|occurred|announced|reported|confirmed|declared)\b/i.test(text);
    const hasStatistics = /\b\d+%\b|\b\d+\s*(?:million|billion|thousand)\b/i.test(text);

    // Extract keywords
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3);

    const stopWords = new Set(['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'this', 'that', 'these', 'those']);
    const keywords = [...new Set(words)]
      .filter(word => !stopWords.has(word))
      .slice(0, 8);

    return {
      hasDates,
      hasEvents,
      hasStatistics,
      detectedDates: [...new Set(detectedDates)],
      keywords
    };
  }

  /**
   * PHASE 2: Broad Web Search & Initial Grounding (ENHANCED)
   */
  private async performBroadWebSearch(text: string, keywords: string[]): Promise<{
    serpResults: any[];
    googleResults: any[];
    aiOverview: string | null;
    factCheckResults: any[];
  }> {
    const claimHash = await generateSHA256(text.toLowerCase().trim());
    const cacheKey = this.cache.generateKey('websearch', claimHash);

    // Check cache
    const cached = await this.cache.get<any>(cacheKey);
    if (cached) {
      console.log('✅ Using cached web search results');
      return cached;
    }

    console.log('🔍 Phase 2: Broad Web Search & Initial Grounding');

    // Parallel API calls for efficiency
    const [serpResponse, googleResults, factCheckResults] = await Promise.allSettled([
      // SERP API for AI Overview + snippets
      this.serpApi.search(`fact check ${text}`, 10).catch(err => {
        console.warn('SERP API failed:', err.message);
        return { results: [], aiOverview: null, totalResults: 0 };
      }),

      // Google Search API for grounding
      googleSearch(`${text} verification`, 10).catch(err => {
        console.warn('Google Search failed:', err.message);
        return [];
      }),

      // Google Fact Check API
      this.factCheckApi.searchClaims(text, 5).catch(err => {
        console.warn('Fact Check API failed:', err.message);
        return [];
      })
    ]);

    const results = {
      serpResults: serpResponse.status === 'fulfilled' ? serpResponse.value.results : [],
      googleResults: googleResults.status === 'fulfilled' ? googleResults.value : [],
      aiOverview: serpResponse.status === 'fulfilled' ? serpResponse.value.aiOverview : null,
      factCheckResults: factCheckResults.status === 'fulfilled' ? factCheckResults.value : []
    };

    // Cache results
    await this.cache.set(cacheKey, results, 'webSearchTTL');

    // Check if we have a clear verdict from Fact Check API
    if (results.factCheckResults.length > 0) {
      const factCheckVerdict = this.analyzeFactCheckConsensus(results.factCheckResults);
      if (factCheckVerdict.clearVerdict) {
        console.log('✅ Clear verdict found from Fact Check API, can skip some analysis');
      }
    }

    return results;
  }

  /**
   * PHASE 3: Specialized & Temporal Analysis (ENHANCED)
   */
  private async performTemporalAnalysis(
    text: string,
    textAnalysis: any
  ): Promise<{
    temporalValidations: TemporalValidation[];
    newsArticles: any[];
    temporalScore: number;
  }> {
    if (!textAnalysis.hasDates && !textAnalysis.hasEvents) {
      console.log('⏩ Skipping temporal analysis - no temporal claims detected');
      return {
        temporalValidations: [],
        newsArticles: [],
        temporalScore: 100
      };
    }

    console.log('📅 Phase 3: Temporal & Specialized Analysis');

    // Get temporal validations
    const temporalValidations = this.temporalService.evaluateTemporalClaims(text);

    // If dates detected, search NewsData API
    let newsArticles: any[] = [];
    if (textAnalysis.detectedDates.length > 0) {
      const primaryDate = textAnalysis.detectedDates[0];
      const claimHash = await generateSHA256(`${text}_${primaryDate}`);
      const cacheKey = this.cache.generateKey('temporal', claimHash, primaryDate);

      const cached = await this.cache.get<any>(cacheKey);
      if (cached) {
        newsArticles = cached;
      } else {
        try {
          const newsResponse = await this.newsDataApi.searchTemporalNews(
            textAnalysis.keywords.join(' '),
            primaryDate,
            3 // ±3 day window
          );
          newsArticles = newsResponse.articles.slice(0, 20);
          await this.cache.set(cacheKey, newsArticles, 'temporalTTL');
        } catch (error) {
          console.warn('NewsData API failed:', error);
        }
      }
    }

    const temporalScore = temporalValidations.filter(v => v.isValid).length /
                         Math.max(temporalValidations.length, 1) * 100;

    return {
      temporalValidations,
      newsArticles,
      temporalScore
    };
  }

  /**
   * COMPREHENSIVE ANALYSIS - ORCHESTRATED
   */
  private async runComprehensiveAnalysis(text: string): Promise<FactCheckReport> {
    console.log('🔍 Running Comprehensive Analysis with Real-Time Fact Checking...');
    const startTime = Date.now();

    // PHASE 1: Text Analysis
    const textAnalysis = await this.analyzeTextStructure(text);
    console.log('📊 Text Analysis:', textAnalysis);

    // PHASE 2: Broad Web Search
    const webSearchResults = await this.performBroadWebSearch(text, textAnalysis.keywords);

    // Combine all search results
    const allSearchResults = [
      ...webSearchResults.serpResults.map(r => ({
        title: r.title,
        link: r.link,
        snippet: r.snippet,
        source: r.source
      })),
      ...webSearchResults.googleResults
    ];

    // PHASE 3: Temporal Analysis (if needed)
    const temporalAnalysis = await this.performTemporalAnalysis(text, textAnalysis);

    // Add news articles to evidence
    if (temporalAnalysis.newsArticles.length > 0) {
      allSearchResults.push(...temporalAnalysis.newsArticles.map(article => ({
        title: article.title,
        link: article.link,
        snippet: article.description,
        source: article.source_name
      })));
    }

    // Process with Citation Service
    const baseReport = await this.citationService.processSearchResults(text, allSearchResults);

    // Enhanced source credibility analysis
    const sourceCredibilityReport = await this.generateSourceCredibilityReport(baseReport.evidence);

    // Media verification (placeholder)
    const mediaVerificationReport = await this.generateMediaVerificationReport(text);

    // Calculate final weighted score
    const finalScore = this.calculateComprehensiveScore(
      baseReport.final_score,
      sourceCredibilityReport.overallScore,
      temporalAnalysis.temporalScore,
      mediaVerificationReport
    );

    // Generate category rating
    const categoryRating = this.ratingService.convertScoreToCategory(
      finalScore,
      sourceCredibilityReport.overallScore,
      baseReport.evidence.length
    );

    // Compile metadata
    const apisUsed = ['citation-augmented', 'source-credibility', 'temporal-context'];
    if (webSearchResults.serpResults.length > 0) apisUsed.push('serp-api');
    if (webSearchResults.googleResults.length > 0) apisUsed.push('google-search');
    if (webSearchResults.factCheckResults.length > 0) apisUsed.push('google-fact-check');
    if (temporalAnalysis.newsArticles.length > 0) apisUsed.push('newsdata-io');

    return {
      ...baseReport,
      final_score: finalScore,
      final_verdict: `Comprehensive Analysis: ${categoryRating.reasoning}`,
      category_rating: categoryRating,
      source_credibility_report: sourceCredibilityReport,
      media_verification_report: mediaVerificationReport,
      temporal_verification: {
        hasTemporalClaims: temporalAnalysis.temporalValidations.length > 0,
        validations: temporalAnalysis.temporalValidations,
        overallTemporalScore: temporalAnalysis.temporalScore,
        temporalWarnings: temporalAnalysis.temporalValidations
          .filter(v => !v.isValid)
          .map(v => v.reasoning)
      },
      user_category_recommendations: this.generateUserCategoryRecommendations(
        finalScore,
        sourceCredibilityReport
      ),
      metadata: {
        ...baseReport.metadata,
        method_used: 'comprehensive',
        processing_time_ms: Date.now() - startTime,
        apis_used: apisUsed,
        sources_consulted: {
          total: allSearchResults.length,
          high_credibility: baseReport.evidence.filter(e => e.score >= 80).length,
          conflicting: 0
        },
        warnings: [
          ...baseReport.metadata.warnings,
          ...sourceCredibilityReport.biasWarnings,
          ...temporalAnalysis.temporalValidations
            .filter(v => !v.isValid)
            .map(v => `Temporal: ${v.reasoning}`)
        ]
      }
    };
  }

  // Helper method to analyze Fact Check API consensus
  private analyzeFactCheckConsensus(factCheckResults: any[]): {
    clearVerdict: boolean;
    consensus: string | null;
  } {
    if (factCheckResults.length === 0) {
      return { clearVerdict: false, consensus: null };
    }

    const ratings = factCheckResults
      .flatMap(result => result.claimReview || [])
      .map(review => review.reviewRating?.textualRating?.toLowerCase());

    const trueCount = ratings.filter(r => r?.includes('true') || r?.includes('correct')).length;
    const falseCount = ratings.filter(r => r?.includes('false') || r?.includes('incorrect')).length;

    if (trueCount >= 2 && falseCount === 0) {
      return { clearVerdict: true, consensus: 'TRUE' };
    }
    if (falseCount >= 2 && trueCount === 0) {
      return { clearVerdict: true, consensus: 'FALSE' };
    }

    return { clearVerdict: false, consensus: null };
  }

  // Keep existing helper methods...
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

  private async generateMediaVerificationReport(text: string): Promise<MediaVerificationReport> {
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
    return Math.round((baseScore * 0.5) + (credibilityScore * 0.3) + (temporalScore * 0.2));
  }

  private generateUserCategoryRecommendations(score: number, credibilityReport: SourceCredibilityReport): any[] {
    return [
      {
        category: 'journalist',
        suitabilityScore: credibilityReport.highCredibilitySources >= 3 ? 95 : 75,
        reasoning: credibilityReport.highCredibilitySources >= 3
          ? 'High-quality sources suitable for professional journalism'
          : 'Adequate sources but may need additional verification'
      }
    ];
  }

  private async runTemporalVerification(text: string): Promise<FactCheckReport> {
    // Simplified version focusing on temporal aspects
    const temporalValidations = this.temporalService.evaluateTemporalClaims(text);
    const baseReport = await this.citationService.performCitationAugmentedAnalysis(text);

    return {
      ...baseReport,
      final_verdict: 'Temporal verification complete',
      temporal_verification: {
        hasTemporalClaims: temporalValidations.length > 0,
        validations: temporalValidations,
        overallTemporalScore: 0,
        temporalWarnings: []
      }
    };
  }

  private generateErrorReport(text: string, method: FactCheckMethod, error: any, processingTime: number): FactCheckReport {
    return {
      id: `error-${Date.now()}`,
      originalText: text,
      final_verdict: 'Analysis failed due to technical error',
      final_score: 0,
      reasoning: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
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