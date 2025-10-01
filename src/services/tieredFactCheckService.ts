import { FactCheckReport, EvidenceItem, PublishingContext } from '../types/factCheck';
import { GoogleFactCheckService } from './googleFactCheckService';
import { SerpApiService } from './serpApiService';
import { NewsDataService } from './newsDataService';
import { AdvancedCacheService } from './advancedCacheService';
import { BlobStorageService } from './blobStorage';
import { generateSHA256 } from '../utils/hashUtils';
import { PerformanceMonitor } from './performanceMonitor';
import { synthesizeEvidenceWithGemini } from './geminiService';

export type FactCheckTier = 'direct-verification' | 'web-search' | 'specialized-analysis' | 'synthesis';

export interface TierResult {
  tier: FactCheckTier;
  success: boolean;
  confidence: number;
  evidence: EvidenceItem[];
  shouldEscalate: boolean;
  processingTime: number;
  error?: string;
}

export class TieredFactCheckService {
  private static instance: TieredFactCheckService;
  private googleFactCheck = GoogleFactCheckService.getInstance();
  private serpApi = SerpApiService.getInstance();
  private newsData = NewsDataService.getInstance();
  private cache = AdvancedCacheService.getInstance();
  private blobStorage = BlobStorageService.getInstance();
  private performanceMonitor = PerformanceMonitor.getInstance();

  static getInstance(): TieredFactCheckService {
    if (!TieredFactCheckService.instance) {
      TieredFactCheckService.instance = new TieredFactCheckService();
    }
    return TieredFactCheckService.instance;
  }

  async performTieredCheck(claimText: string, publishingContext: PublishingContext): Promise<FactCheckReport> {
    const startTime = Date.now();
    const reportId = await generateSHA256(`tiered_${claimText}_${startTime}`);

    console.log('🎯 Starting Tiered Fact Check Process');

    const tierResults: TierResult[] = [];
    let finalEvidence: EvidenceItem[] = [];
    let finalScore = 0;
    let finalVerdict = 'Unverified';

    try {
      // Phase 1: Direct Verification (Fast & Economical)
      const phase1Result = await this.runDirectVerification(claimText);
      tierResults.push(phase1Result);

      if (phase1Result.success && !phase1Result.shouldEscalate) {
        console.log('✅ Phase 1 Complete - High confidence match found');
        finalEvidence = phase1Result.evidence;
        finalScore = phase1Result.confidence;
        finalVerdict = this.generateVerdict(finalScore);
      } else {
        console.log('⏭️  Phase 1 Escalating to Phase 2');

        // Phase 2: Broad Web Search & Initial Grounding
        const phase2Result = await this.runBroadWebSearch(claimText);
        tierResults.push(phase2Result);
        finalEvidence.push(...phase2Result.evidence);

        if (phase2Result.success && !phase2Result.shouldEscalate) {
          console.log('✅ Phase 2 Complete - Clear verdict found');
          finalScore = phase2Result.confidence;
          finalVerdict = this.generateVerdict(finalScore);
        } else {
          console.log('⏭️  Phase 2 Escalating to Phase 3');

          // Phase 3: Specialized & Temporal Analysis
          const phase3Result = await this.runSpecializedAnalysis(claimText);
          tierResults.push(phase3Result);
          finalEvidence.push(...phase3Result.evidence);

          console.log('⏭️  Proceeding to Phase 4 - Synthesis');

          // Phase 4: Multi-Source Synthesis & Final Verdict
          const phase4Result = await this.runSynthesisPhase(claimText, finalEvidence, publishingContext);
          tierResults.push(phase4Result);

          finalScore = phase4Result.confidence;
          finalVerdict = this.generateVerdict(finalScore);
        }
      }

      // Create comprehensive report
      const report: FactCheckReport = {
        id: reportId,
        originalText: claimText,
        final_verdict: finalVerdict,
        final_score: finalScore,
        evidence: finalEvidence,
        reasoning: this.generateReasoning(tierResults),
        enhanced_claim_text: claimText,
        score_breakdown: {
          final_score_formula: this.generateScoreFormula(tierResults),
          metrics: this.generateMetrics(tierResults),
          confidence_intervals: {
            lower_bound: Math.max(0, finalScore - 15),
            upper_bound: Math.min(100, finalScore + 15)
          }
        },
        metadata: {
          method_used: 'tiered-verification',
          processing_time_ms: Date.now() - startTime,
          apis_used: this.getUsedApis(tierResults),
          sources_consulted: {
            total: finalEvidence.length,
            high_credibility: finalEvidence.filter(e => Number(e.score) >= 80).length,
            conflicting: 0
          },
          warnings: this.generateWarnings(tierResults),
          tier_breakdown: tierResults.map(r => ({
            tier: r.tier,
            success: r.success,
            confidence: r.confidence,
            processing_time_ms: r.processingTime,
            evidence_count: r.evidence.length
          }))
        },
        // Required fields with defaults
        source_credibility_report: {
          overallScore: Math.round(finalEvidence.reduce((sum, e) => sum + e.score, 0) / Math.max(finalEvidence.length, 1)),
          highCredibilitySources: finalEvidence.filter(e => e.score >= 80).length,
          flaggedSources: 0,
          biasWarnings: [],
          credibilityBreakdown: { academic: 0, news: finalEvidence.length, government: 0, social: 0 }
        },
        temporal_verification: {
          hasTemporalClaims: false,
          validations: [],
          overallTemporalScore: 100,
          temporalWarnings: []
        }
      };

      // Upload to blob storage
      try {
        await this.uploadReportToBlob(report);
        console.log('✅ Report uploaded to blob storage');
      } catch (error) {
        console.warn('⚠️  Failed to upload to blob storage:', error);
      }

      // Record performance metric
      this.performanceMonitor.recordMetric({
        operation: 'tiered-fact-check',
        duration: Date.now() - startTime,
        timestamp: startTime,
        success: true
      });

      return report;

    } catch (error) {
      console.error('❌ Tiered fact check failed:', error);

      // Record error metric
      this.performanceMonitor.recordMetric({
        operation: 'tiered-fact-check',
        duration: Date.now() - startTime,
        timestamp: startTime,
        success: false
      });

      return this.createErrorReport(claimText, reportId, error, Date.now() - startTime);
    }
  }

  private async runDirectVerification(claimText: string): Promise<TierResult> {
    const startTime = Date.now();
    console.log('📋 Phase 1: Direct Verification');

    try {
      const factCheckResults = await this.googleFactCheck.searchClaims(claimText, 5);

      if (factCheckResults.length === 0) {
        return {
          tier: 'direct-verification',
          success: false,
          confidence: 0,
          evidence: [],
          shouldEscalate: true,
          processingTime: Date.now() - startTime
        };
      }

      // Convert fact check results to evidence
      const evidence: EvidenceItem[] = factCheckResults.map((result, index) => ({
        id: `fact_check_${index}`,
        publisher: result.claimReview[0]?.publisher || 'Fact Checker',
        url: result.claimReview[0]?.url || null,
        quote: `${result.text} - Rating: ${result.claimReview[0]?.reviewRating?.textualRating || 'Unknown'}`,
        score: this.convertRatingToScore(result.claimReview[0]?.reviewRating),
        type: 'claim'
      }));

      const avgScore = evidence.reduce((sum, e) => sum + e.score, 0) / evidence.length;
      const highConfidenceThreshold = 80;

      return {
        tier: 'direct-verification',
        success: true,
        confidence: avgScore,
        evidence,
        shouldEscalate: avgScore < highConfidenceThreshold,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      console.warn('⚠️  Phase 1 failed:', error);
      return {
        tier: 'direct-verification',
        success: false,
        confidence: 0,
        evidence: [],
        shouldEscalate: true,
        processingTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async runBroadWebSearch(claimText: string): Promise<TierResult> {
    const startTime = Date.now();
    console.log('🔍 Phase 2: Broad Web Search & Initial Grounding');

    try {
      const searchResults = await this.serpApi.search(claimText, 10);

      if (searchResults.results.length === 0) {
        return {
          tier: 'web-search',
          success: false,
          confidence: 30,
          evidence: [],
          shouldEscalate: true,
          processingTime: Date.now() - startTime
        };
      }

      // Convert search results to evidence
      const evidence: EvidenceItem[] = searchResults.results.slice(0, 8).map((result, index) => ({
        id: `web_search_${index}`,
        publisher: result.source,
        url: result.link,
        quote: result.snippet,
        score: this.calculateSearchResultScore(result, claimText),
        type: 'search_result'
      }));

      const avgScore = evidence.reduce((sum, e) => sum + e.score, 0) / evidence.length;

      // Check if sources agree (simple consensus check)
      const highScoreCount = evidence.filter(e => Number(e.score) >= 70).length;
      const lowScoreCount = evidence.filter(e => e.score <= 40).length;
      const clearConsensus = (highScoreCount >= 5 && lowScoreCount <= 1) || (lowScoreCount >= 5 && highScoreCount <= 1);

      return {
        tier: 'web-search',
        success: true,
        confidence: avgScore,
        evidence,
        shouldEscalate: !clearConsensus || avgScore < 70,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      console.warn('⚠️  Phase 2 failed:', error);
      return {
        tier: 'web-search',
        success: false,
        confidence: 30,
        evidence: [],
        shouldEscalate: true,
        processingTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async runSpecializedAnalysis(claimText: string): Promise<TierResult> {
    const startTime = Date.now();
    console.log('🎯 Phase 3: Specialized & Temporal Analysis');

    try {
      const evidence: EvidenceItem[] = [];

      // Check if claim involves dates/events for temporal analysis
      const hasTemporalElements = this.detectTemporalElements(claimText);

      if (hasTemporalElements.hasTemporalClaims) {
        console.log('📅 Temporal elements detected, fetching recent news');

        const newsResults = await this.newsData.searchTemporalNews(
          claimText,
          hasTemporalElements.extractedDate || new Date().toISOString(),
          3
        );

        const newsEvidence: EvidenceItem[] = newsResults.articles.slice(0, 6).map((article, index) => ({
          id: `news_${index}`,
          publisher: article.source_name,
          url: article.link,
          quote: article.description,
          score: this.calculateNewsScore(article, claimText),
          type: 'news',
          publishedDate: article.pubDate
        }));

        evidence.push(...newsEvidence);
      }

      // Additional specialized searches for specific claim types
      const claimType = this.detectClaimType(claimText);
      if (claimType !== 'general') {
        console.log(`🔬 Specialized search for ${claimType} claim`);
        const specializedResults = await this.performSpecializedSearch(claimText, claimType);
        evidence.push(...specializedResults);
      }

      const avgScore = evidence.length > 0
        ? evidence.reduce((sum, e) => sum + e.score, 0) / evidence.length
        : 50;

      return {
        tier: 'specialized-analysis',
        success: evidence.length > 0,
        confidence: avgScore,
        evidence,
        shouldEscalate: true, // Always escalate to synthesis for final decision
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      console.warn('⚠️  Phase 3 failed:', error);
      return {
        tier: 'specialized-analysis',
        success: false,
        confidence: 40,
        evidence: [],
        shouldEscalate: true,
        processingTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async runSynthesisPhase(claimText: string, allEvidence: EvidenceItem[], publishingContext: PublishingContext): Promise<TierResult> {
    const startTime = Date.now();
    console.log('🧠 Phase 4: Gemini-Powered Synthesis');

    try {
        const synthesisReport = await synthesizeEvidenceWithGemini(claimText, allEvidence, publishingContext);

        // If Gemini returns new evidence, you might want to add it to the final report.
        // For now, we'll use the score and verdict from Gemini's synthesis.
        const finalEvidence = synthesisReport.evidence || [];

        return {
            tier: 'synthesis',
            success: true,
            confidence: synthesisReport.final_score,
            evidence: finalEvidence, // Use evidence from Gemini's report
            shouldEscalate: false,
            processingTime: Date.now() - startTime,
        };
    } catch (error) {
        console.error('❌ Phase 4 Gemini synthesis failed:', error);
        // Fallback to original synthesis logic if Gemini fails
        try {
            console.log('⚠️ Gemini synthesis failed. Falling back to original weighted synthesis.');
            const fallbackResult = this.fallbackSynthesis(allEvidence);
            return {
                tier: 'synthesis',
                success: true, // The fallback succeeded
                confidence: fallbackResult.adjustedScore,
                evidence: [],
                shouldEscalate: false,
                processingTime: Date.now() - startTime,
            };
        } catch (fallbackError) {
            console.error('❌ Fallback synthesis also failed:', fallbackError);
            return {
                tier: 'synthesis',
                success: false,
                confidence: 30, // Default low confidence on complete failure
                evidence: [],
                shouldEscalate: false,
                processingTime: Date.now() - startTime,
                error: fallbackError instanceof Error ? fallbackError.message : 'Unknown fallback error'
            };
        }
    }
}

private fallbackSynthesis(allEvidence: EvidenceItem[]): { adjustedScore: number } {
    const highCredibilityEvidence = allEvidence.filter(e => e.score >= 80);
    const mediumCredibilityEvidence = allEvidence.filter(e => e.score >= 50 && e.score < 80);
    const lowCredibilityEvidence = allEvidence.filter(e => e.score < 50);

    const totalWeight =
        (highCredibilityEvidence.length * 3) +
        (mediumCredibilityEvidence.length * 2) +
        (lowCredibilityEvidence.length * 1);

    const weightedSum =
        (highCredibilityEvidence.reduce((sum, e) => sum + e.score, 0) * 3) +
        (mediumCredibilityEvidence.reduce((sum, e) => sum + e.score, 0) * 2) +
        (lowCredibilityEvidence.reduce((sum, e) => sum + e.score, 0) * 1);

    const finalScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 50;

    const supportingEvidence = allEvidence.filter(e => e.score >= 60);
    const contradictingEvidence = allEvidence.filter(e => e.score <= 40);

    let adjustedScore = finalScore;
    if (contradictingEvidence.length > 0 && supportingEvidence.length > 0) {
        adjustedScore = Math.max(30, finalScore - 15);
    }

    return { adjustedScore };
}

  // Helper Methods
  private convertRatingToScore(rating: any): number {
    if (!rating) return 50;

    const textualRating = rating.textualRating?.toLowerCase() || '';
    if (textualRating.includes('true') || textualRating.includes('accurate')) return 90;
    if (textualRating.includes('mostly true')) return 75;
    if (textualRating.includes('mixed') || textualRating.includes('half')) return 50;
    if (textualRating.includes('mostly false')) return 25;
    if (textualRating.includes('false') || textualRating.includes('pants on fire')) return 10;

    // Use numeric rating if available
    if (rating.ratingValue && rating.bestRating) {
      return Math.round((rating.ratingValue / rating.bestRating) * 100);
    }

    return 50;
  }

  private calculateSearchResultScore(result: any, claimText: string): number {
    let score = 50; // Base score
    const domain = result.source.toLowerCase();

    // Tiered domain credibility scoring
    const credibilityTiers = [
      { domains: ['reuters', 'ap.org', 'bbc', 'apnews'], boost: 35 },
      { domains: ['factcheck', 'snopes', 'politifact'], boost: 30 },
      { domains: ['cnn', 'nytimes', 'washingtonpost', 'wsj', 'theguardian'], boost: 20 },
      { domains: ['.gov', '.edu'], boost: 25 },
      { domains: ['wikipedia'], boost: 5, penalty: 0 }, // Lower boost for Wikipedia
      { domains: ['forbes', 'businessinsider'], boost: 10 },
      { domains: ['reddit', 'quora', 'facebook', 'twitter'], boost: 0, penalty: 25 }, // Penalize social media
      { domains: ['blogspot', 'wordpress', 'medium'], boost: 0, penalty: 20 } // Penalize blog platforms
    ];

    let appliedBoost = 0;
    let appliedPenalty = 0;

    for (const tier of credibilityTiers) {
      if (tier.domains.some(d => domain.includes(d))) {
        appliedBoost = tier.boost;
        appliedPenalty = tier.penalty || 0;
        break;
      }
    }

    score += appliedBoost - appliedPenalty;


    // Enhanced content relevance boost
    const snippet = result.snippet.toLowerCase();
    const title = result.title.toLowerCase();
    const claimWords = claimText.toLowerCase().match(/\b(\w+)\b/g) || [];
    const snippetWords = snippet.match(/\b(\w+)\b/g) || [];
    const titleWords = title.match(/\b(\w+)\b/g) || [];

    const matchedInSnippet = claimWords.filter(word => snippetWords.includes(word)).length;
    const matchedInTitle = claimWords.filter(word => titleWords.includes(word)).length;

    // More weight for title matches
    const relevanceScore = (matchedInSnippet / claimWords.length) * 15 + (matchedInTitle / claimWords.length) * 20;

    score += relevanceScore;

    // Snippet sentiment analysis (basic)
    const negativeKeywords = ['conspiracy', 'hoax', 'unproven', 'scam'];
    if (negativeKeywords.some(kw => snippet.includes(kw))) {
      score -= 15;
    }

    return Math.min(100, Math.max(0, score));
  }

  private calculateNewsScore(article: any, claimText: string): number {
    let score = 55; // Adjusted base score for more detailed calculation
    const sourceName = article.source_name.toLowerCase();
    const description = article.description.toLowerCase();
    const title = article.title.toLowerCase();

    // Granular source credibility with penalties
    const sourceTiers = [
        { sources: ['reuters', 'associated press', 'ap', 'bbc news', 'npr', 'pbs'], boost: 25 },
        { sources: ['cnn', 'abc news', 'nbc news', 'cbs news', 'the guardian', 'al jazeera'], boost: 15 },
        { sources: ['fox news', 'msnbc', 'breitbart', 'daily mail'], penalty: 15 }, // Known for strong bias
        { sources: ['washington post', 'new york times', 'wsj'], boost: 20 },
    ];

    let appliedBoost = 0;
    let appliedPenalty = 0;

    for (const tier of sourceTiers) {
        if (tier.sources.some(s => sourceName.includes(s))) {
            appliedBoost = tier.boost || 0;
            appliedPenalty = tier.penalty || 0;
            break;
        }
    }
    score += appliedBoost - appliedPenalty;


    // Recency boost (more granular)
    const daysOld = (Date.now() - new Date(article.pubDate).getTime()) / (1000 * 60 * 60 * 24);
    if (daysOld <= 2) score += 15;
    else if (daysOld <= 10) score += 10;
    else if (daysOld <= 45) score += 5;
    else if (daysOld > 180) score -= 10; // Penalize very old news


    // Content analysis for bias and depth
    const biasedKeywords = ['outrageous', 'shocking', 'slams', 'destroys', 'miracle', 'agenda'];
    const biasedMentions = biasedKeywords.filter(kw => description.includes(kw) || title.includes(kw)).length;
    score -= biasedMentions * 5; // Penalize for each biased keyword

    // Boost for article length (as a proxy for depth)
    if (article.description.length > 250) {
        score += 10;
    }

    // Keyword relevance in title
    const claimWords = claimText.toLowerCase().match(/\b(\w+)\b/g) || [];
    const titleWords = title.match(/\b(\w+)\b/g) || [];
    const matchedInTitle = claimWords.filter(word => titleWords.includes(word)).length;

    if (matchedInTitle / claimWords.length > 0.5) {
        score += 10; // Boost if title is highly relevant
    }

    return Math.min(100, Math.max(0, score));
  }

  private detectTemporalElements(text: string): { hasTemporalClaims: boolean; extractedDate?: string } {
    const temporalPatterns = [
      /\b\d{4}\b/, // Years
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}\b/i,
      /\b\d{1,2}\/\d{1,2}\/\d{4}\b/, // Dates
      /\b(today|yesterday|tomorrow|last week|next week|recently|currently)\b/i
    ];

    for (const pattern of temporalPatterns) {
      const match = text.match(pattern);
      if (match) {
        return {
          hasTemporalClaims: true,
          extractedDate: match[0]
        };
      }
    }

    return { hasTemporalClaims: false };
  }

  private detectClaimType(text: string): 'medical' | 'political' | 'scientific' | 'financial' | 'general' {
    const medicalKeywords = ['vaccine', 'covid', 'virus', 'disease', 'treatment', 'medicine', 'health'];
    const politicalKeywords = ['president', 'election', 'vote', 'government', 'policy', 'congress'];
    const scientificKeywords = ['research', 'study', 'scientist', 'climate', 'global warming', 'experiment'];
    const financialKeywords = ['stock', 'economy', 'inflation', 'market', 'financial', 'investment'];

    const lowerText = text.toLowerCase();

    if (medicalKeywords.some(k => lowerText.includes(k))) return 'medical';
    if (politicalKeywords.some(k => lowerText.includes(k))) return 'political';
    if (scientificKeywords.some(k => lowerText.includes(k))) return 'scientific';
    if (financialKeywords.some(k => lowerText.includes(k))) return 'financial';

    return 'general';
  }

  private async performSpecializedSearch(claimText: string, claimType: string): Promise<EvidenceItem[]> {
    const specializedQueries = {
      medical: `${claimText} site:cdc.gov OR site:who.int OR site:pubmed.ncbi.nlm.nih.gov`,
      political: `${claimText} site:factcheck.org OR site:politifact.com OR site:snopes.com`,
      scientific: `${claimText} site:nature.com OR site:science.org OR site:arxiv.org`,
      financial: `${claimText} site:sec.gov OR site:federalreserve.gov OR site:reuters.com`,
      general: claimText
    };

    try {
      const results = await this.serpApi.search(specializedQueries[claimType as keyof typeof specializedQueries] || claimText, 5);

      return results.results.map((result, index) => ({
        id: `specialized_${claimType}_${index}`,
        publisher: result.source,
        url: result.link,
        quote: result.snippet,
        score: this.calculateSearchResultScore(result, claimText) + 10, // Boost for specialized sources
        type: 'search_result'
      }));
    } catch {
      return [];
    }
  }

  private generateVerdict(score: number): string {
    if (score >= 85) return 'TRUE - Highly Verified';
    if (score >= 70) return 'MOSTLY TRUE - Well Supported';
    if (score >= 50) return 'MIXED - Partial Accuracy';
    if (score >= 30) return 'MOSTLY FALSE - Limited Support';
    return 'FALSE - Contradicted by Evidence';
  }

  private generateReasoning(tierResults: TierResult[]): string {
    const completedTiers = tierResults.filter(r => r.success);
    const totalEvidence = tierResults.reduce((sum, r) => sum + r.evidence.length, 0);

    let reasoning = `Completed ${completedTiers.length} verification phases with ${totalEvidence} evidence sources. `;

    tierResults.forEach((result, index) => {
      const phase = index + 1;
      if (result.success) {
        reasoning += `Phase ${phase} (${result.tier}) found ${result.evidence.length} sources with ${result.confidence}% confidence. `;
      } else if (result.error) {
        reasoning += `Phase ${phase} encountered issues: ${result.error}. `;
      }
    });

    return reasoning;
  }

  private generateScoreFormula(tierResults: TierResult[]): string {
    const phases = tierResults.map((r, i) => `Phase ${i + 1}: ${r.confidence}%`);
    return `Tiered Analysis: ${phases.join(' → ')}`;
  }

  private generateMetrics(tierResults: TierResult[]): any[] {
    return tierResults.map((result, index) => ({
      name: `Phase ${index + 1} - ${result.tier.replace('-', ' ').toUpperCase()}`,
      score: result.confidence,
      description: `${result.success ? 'Successful' : 'Failed'} analysis with ${result.evidence.length} evidence items`
    }));
  }

  private getUsedApis(tierResults: TierResult[]): string[] {
    const apis: string[] = ['tiered-orchestrator'];

    tierResults.forEach(result => {
      switch (result.tier) {
        case 'direct-verification':
          apis.push('google-fact-check');
          break;
        case 'web-search':
          apis.push('serp-api');
          break;
        case 'specialized-analysis':
          apis.push('newsdata-io');
          break;
        case 'synthesis':
          apis.push('multi-source-synthesis');
          break;
      }
    });

    return [...new Set(apis)];
  }

  private generateWarnings(tierResults: TierResult[]): string[] {
    const warnings: string[] = [];

    const failedTiers = tierResults.filter(r => !r.success);
    if (failedTiers.length > 0) {
      warnings.push(`${failedTiers.length} verification phase(s) failed - results may be incomplete`);
    }

    const totalEvidence = tierResults.reduce((sum, r) => sum + r.evidence.length, 0);
    if (totalEvidence < 3) {
      warnings.push('Limited evidence available - consider additional manual verification');
    }

    return warnings;
  }

  private async uploadReportToBlob(report: FactCheckReport): Promise<void> {
    try {
      const reportData = {
        id: report.id,
        originalText: report.originalText,
        report,
        corrections: [],
        timestamp: new Date().toISOString()
      };

      await this.blobStorage.saveReport(reportData);
    } catch (error) {
      console.error('Failed to upload report to blob:', error);
      throw error;
    }
  }

  private createErrorReport(claimText: string, reportId: string, error: any, processingTime: number): FactCheckReport {
    return {
      id: reportId,
      originalText: claimText,
      final_verdict: 'ANALYSIS ERROR',
      final_score: 0,
      evidence: [],
      reasoning: `Tiered analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      enhanced_claim_text: claimText,
      score_breakdown: {
        final_score_formula: 'Error occurred during analysis',
        metrics: [{
          name: 'Error Status',
          score: 0,
          description: 'Analysis could not be completed'
        }]
      },
      metadata: {
        method_used: 'tiered-verification-error',
        processing_time_ms: processingTime,
        apis_used: ['error-handler'],
        sources_consulted: { total: 0, high_credibility: 0, conflicting: 0 },
        warnings: [`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      },
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
      }
    };
  }
}