import { FactCheckReport, EvidenceItem } from '../types/factCheck';
import { GoogleFactCheckService } from './googleFactCheckService';
import { SerpApiService } from './serpApiService';
import { NewsDataService } from './newsDataService';
import { AdvancedCacheService } from './advancedCacheService';
import { BlobStorageService } from './blobStorage';
import { generateSHA256 } from '../utils/hashUtils';
import { PerformanceMonitor } from './performanceMonitor';

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

  async performTieredCheck(claimText: string): Promise<FactCheckReport> {
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
          const phase4Result = await this.runSynthesisPhase(claimText, finalEvidence);
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
        },
        user_category_recommendations: []
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

  private async runSynthesisPhase(claimText: string, allEvidence: EvidenceItem[]): Promise<TierResult> {
    const startTime = Date.now();
    console.log('🧠 Phase 4: Multi-Source Synthesis & Final Verdict');

    try {
      // Aggregate evidence by source credibility
      const highCredibilityEvidence = allEvidence.filter(e => e.score >= 80);
      const mediumCredibilityEvidence = allEvidence.filter(e => e.score >= 50 && e.score < 80);
      const lowCredibilityEvidence = allEvidence.filter(e => e.score < 50);

      // Calculate weighted score
      const totalWeight =
        (highCredibilityEvidence.length * 3) +
        (mediumCredibilityEvidence.length * 2) +
        (lowCredibilityEvidence.length * 1);

      const weightedSum =
        (highCredibilityEvidence.reduce((sum, e) => sum + e.score, 0) * 3) +
        (mediumCredibilityEvidence.reduce((sum, e) => sum + e.score, 0) * 2) +
        (lowCredibilityEvidence.reduce((sum, e) => sum + e.score, 0) * 1);

      const finalScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 50;

      // Check for contradictory evidence
      const supportingEvidence = allEvidence.filter(e => e.score >= 60);
      const contradictingEvidence = allEvidence.filter(e => e.score <= 40);

      let adjustedScore = finalScore;
      if (contradictingEvidence.length > 0 && supportingEvidence.length > 0) {
        // Reduce confidence when there's contradictory evidence
        adjustedScore = Math.max(30, finalScore - 15);
      }

      return {
        tier: 'synthesis',
        success: true,
        confidence: adjustedScore,
        evidence: [], // Evidence already aggregated
        shouldEscalate: false,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      console.error('❌ Phase 4 synthesis failed:', error);
      return {
        tier: 'synthesis',
        success: false,
        confidence: 30,
        evidence: [],
        shouldEscalate: false,
        processingTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
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

    // Domain credibility boost
    const domain = result.source.toLowerCase();
    if (domain.includes('reuters') || domain.includes('ap.org') || domain.includes('bbc')) score += 25;
    else if (domain.includes('cnn') || domain.includes('nytimes') || domain.includes('washingtonpost')) score += 15;
    else if (domain.includes('factcheck') || domain.includes('snopes') || domain.includes('politifact')) score += 30;
    else if (domain.includes('.gov') || domain.includes('.edu')) score += 20;
    else if (domain.includes('wikipedia')) score += 10;

    // Content relevance boost
    const snippet = result.snippet.toLowerCase();
    const claimWords = claimText.toLowerCase().split(' ').filter(w => w.length > 3);
    const matchedWords = claimWords.filter(word => snippet.includes(word));
    const relevanceScore = (matchedWords.length / claimWords.length) * 20;

    return Math.min(100, Math.max(10, score + relevanceScore));
  }

  private calculateNewsScore(article: any, claimText: string): number {
    let score = 60; // Base news score

    // Source credibility
    const sourceName = article.source_name.toLowerCase();
    if (['reuters', 'associated press', 'bbc news', 'npr'].some(s => sourceName.includes(s))) score += 20;
    else if (['cnn', 'abc news', 'nbc news', 'cbs news'].some(s => sourceName.includes(s))) score += 10;

    // Recency boost
    const daysOld = (Date.now() - new Date(article.pubDate).getTime()) / (1000 * 60 * 60 * 24);
    if (daysOld <= 1) score += 15;
    else if (daysOld <= 7) score += 10;
    else if (daysOld <= 30) score += 5;

    return Math.min(100, Math.max(20, score));
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
      },
      user_category_recommendations: []
    };
  }
}