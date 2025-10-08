// src/services/tieredFactCheckService.ts - FIXED VERSION
// Resolves synthesis issues and news API problems + TypeScript build errors

import { FactCheckReport, EvidenceItem, PublishingContext } from '../types/factCheck';
import { GoogleFactCheckService } from './googleFactCheckService';
import { SerpApiService } from './serpApiService';
import { WebzNewsService } from './webzNewsService';
import { AdvancedCacheService } from './advancedCacheService';
import { BlobStorageService } from './blobStorage';
import { EnhancedFactCheckService } from './EnhancedFactCheckService';
import { generateSHA256 } from '../utils/hashUtils';
import { PerformanceMonitor } from './performanceMonitor';
import { synthesizeEvidenceWithGemini } from './geminiService';

export type FactCheckTier = 'direct-verification' | 'pipeline-search' | 'specialized-analysis' | 'synthesis';

export interface TierResult {
  tier: FactCheckTier;
  success: boolean;
  confidence: number;
  evidence: EvidenceItem[];
  shouldEscalate: boolean;
  processingTime: number;
  error?: string;
  metadata?: {
    entitiesExtracted?: number;
    claimsIdentified?: number;
    queriesExecuted?: number;
    pipelineUsed?: boolean;
  };
}

const THRESHOLDS = {
  phase1ToPhase2: {
    minConfidence: 75,
    minEvidence: 2
  },
  phase2ToPhase3: {
    minConfidence: 60, // Lowered from 65
    minEvidence: 2, // Lowered from 3
    minAvgScore: 55 // Lowered from 65
  }
};

export class TieredFactCheckService {
  private static instance: TieredFactCheckService;
  private googleFactCheck = GoogleFactCheckService.getInstance();
  private serpApi = SerpApiService.getInstance();
  private newsService = new WebzNewsService();
  private enhancedService = new EnhancedFactCheckService();
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

    console.log('🎯 Starting Enhanced Tiered Fact Check with Pipeline Integration');
    console.log('📝 Text length:', claimText.length);

    const tierResults: TierResult[] = [];
    let finalReport: FactCheckReport | null = null;

    try {
      // PHASE 1: Direct Fact-Check Verification
      console.log('\n📋 Phase 1: Direct Fact-Check Verification');
      const phase1Result = await this.runPhase1DirectVerification(claimText);
      tierResults.push(phase1Result);

      if (!this.shouldEscalate(1, phase1Result)) {
        console.log('✅ Phase 1 COMPLETE - High confidence match found');
        finalReport = this.buildReportFromPhase1(claimText, reportId, phase1Result, tierResults, startTime);
      } else {
        console.log('⏭️  Phase 1 → Phase 2: Using Advanced Pipeline');

        // PHASE 2: Advanced Query Pipeline
        const phase2Result = await this.runPhase2AdvancedPipeline(claimText);
        tierResults.push(phase2Result);

        // ⚠️ FIX: Check if we actually got evidence before deciding
        const hasGoodEvidence = phase2Result.evidence.length >= 3 && phase2Result.confidence >= 60;

        if (hasGoodEvidence && !this.shouldEscalate(2, phase2Result)) {
          console.log('✅ Phase 2 COMPLETE - Sufficient evidence found');
          finalReport = phase2Result.report!;
        } else {
          console.log('⏭️  Phase 2 → Phase 3: Specialized Analysis');

          // PHASE 3: Specialized Analysis
          const phase3Result = await this.runPhase3SpecializedAnalysis(claimText, phase2Result.report!);
          tierResults.push(phase3Result);

          // Combine evidence from phase 2 and 3
          const combinedEvidence = [
            ...phase2Result.evidence,
            ...phase3Result.evidence
          ];

          console.log('⏭️  Phase 3 → Phase 4: Final Synthesis');

          // PHASE 4: AI Synthesis
          const phase4Result = await this.runPhase4Synthesis(
            claimText,
            phase2Result.report!,
            combinedEvidence,
            publishingContext
          );
          tierResults.push(phase4Result);

          finalReport = phase4Result.report || phase2Result.report!;
        }
      }

      const enrichedReport = this.enrichReportWithTierData(finalReport!, tierResults, startTime);
      
      // ⚠️ FIX: Only upload if we have actual evidence
      if (enrichedReport.evidence.length > 0) {
        await this.uploadReportToBlob(enrichedReport);
        console.log('✅ Report uploaded to blob storage');
      } else {
        console.warn('⚠️ Skipping blob upload - no evidence collected');
      }

      this.performanceMonitor.recordMetric({
        operation: 'tiered-fact-check',
        duration: Date.now() - startTime,
        timestamp: startTime,
        success: true
      });

      return enrichedReport;

    } catch (error) {
      console.error('❌ Tiered fact check failed:', error);

      this.performanceMonitor.recordMetric({
        operation: 'tiered-fact-check',
        duration: Date.now() - startTime,
        timestamp: startTime,
        success: false
      });

      return this.createErrorReport(claimText, reportId, error, Date.now() - startTime);
    }
  }

  // ✅ FIXED: Line 178 - Proper type handling for publisher field
  private async runPhase1DirectVerification(text: string): Promise<TierResult> {
    const startTime = Date.now();

    try {
      const query = this.extractSmartQuery(text, 100);
      console.log('🔍 Fact-check query:', query);

      const report = await this.googleFactCheck.searchClaims(query, 5);

      if (!report || report.evidence.length === 0) {
        console.log('ℹ️ No direct fact-check matches found');
        return {
          tier: 'direct-verification',
          success: false,
          confidence: 0,
          evidence: [],
          shouldEscalate: true,
          processingTime: Date.now() - startTime,
        };
      }

      const evidence: EvidenceItem[] = report.evidence;
      const avgScore = report.final_score;
      console.log(`✅ Found ${evidence.length} fact-check results (avg: ${avgScore.toFixed(1)}%)`);

      return {
        tier: 'direct-verification',
        success: true,
        confidence: avgScore,
        evidence,
        shouldEscalate: avgScore < THRESHOLDS.phase1ToPhase2.minConfidence,
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

  private async runPhase2AdvancedPipeline(text: string): Promise<TierResult & { report?: FactCheckReport }> {
    const startTime = Date.now();
    console.log('🚀 Phase 2: Advanced Query Pipeline Analysis');

    try {
      const report = await this.enhancedService.orchestrateFactCheck(text, 'comprehensive');

      const evidenceCount = report.evidence.length;
      const avgScore = evidenceCount > 0
        ? report.evidence.reduce((sum, e) => sum + e.score, 0) / evidenceCount
        : 0;

      console.log(`✅ Pipeline analysis complete:`);
      console.log(`   - Evidence: ${evidenceCount} sources`);
      console.log(`   - Avg score: ${avgScore.toFixed(1)}%`);
      console.log(`   - Entities: ${report.extractedEntities?.length || 0}`);
      console.log(`   - Claims: ${report.claimBreakdown?.length || 0}`);

      // ⚠️ FIX: Better escalation logic
      const shouldEscalate = evidenceCount < THRESHOLDS.phase2ToPhase3.minEvidence ||
                            avgScore < THRESHOLDS.phase2ToPhase3.minAvgScore ||
                            report.final_score < THRESHOLDS.phase2ToPhase3.minConfidence;

      return {
        tier: 'pipeline-search',
        success: evidenceCount > 0,
        confidence: report.final_score,
        evidence: report.evidence,
        shouldEscalate,
        processingTime: Date.now() - startTime,
        report,
        metadata: {
          entitiesExtracted: report.extractedEntities?.length || 0,
          claimsIdentified: report.claimBreakdown?.length || 0,
          queriesExecuted: (report.metadata as any).pipelineMetadata?.queriesExecuted || 0,
          pipelineUsed: true
        }
      };

    } catch (error) {
      console.error('❌ Phase 2 pipeline failed:', error);
      console.warn('⚠️  Falling back to basic SERP search...');
      
      const fallbackResult = await this.fallbackBasicSearch(text);

      return {
        tier: 'pipeline-search',
        success: fallbackResult.evidence.length > 0,
        confidence: fallbackResult.final_score,
        evidence: fallbackResult.evidence,
        shouldEscalate: true,
        processingTime: Date.now() - startTime,
        report: fallbackResult,
        error: `Pipeline failed, used fallback: ${error instanceof Error ? error.message : 'Unknown'}`
      };
    }
  }

  private async runPhase3SpecializedAnalysis(
    text: string,
    phase2Report: FactCheckReport
  ): Promise<TierResult> {
    const startTime = Date.now();
    console.log('🎯 Phase 3: Specialized Analysis with Pipeline Insights');

    const evidence: EvidenceItem[] = [];
    const pipelineMetadata = (phase2Report.metadata as any).pipelineMetadata;
    const extractedEntities = phase2Report.extractedEntities || [];

    console.log(`   - Using ${extractedEntities.length} extracted entities`);
    console.log(`   - Claim complexity: ${pipelineMetadata?.complexity || 'unknown'}`);

    try {
      // ⚠️ FIX: Better News API usage with fallback
      if (phase2Report.temporal_verification?.hasTemporalClaims || extractedEntities.length > 0) {
        console.log('📅 Searching for related news articles');

        const entityNames = extractedEntities
          .filter(e => ['PERSON', 'ORGANIZATION', 'EVENT', 'LOCATION'].includes(e.type))
          .slice(0, 3)
          .map(e => e.name);

        if (entityNames.length > 0) {
          const newsQuery = entityNames.join(' ');
          console.log(`🔍 News query: "${newsQuery}"`);

          try {
            const newsResults = await this.newsService.searchNews({
              query: newsQuery,
              fromDate: this.extractRecentDate(text)
            });

            if (newsResults?.posts?.length > 0) {
              const newsEvidence = newsResults.posts.slice(0, 5).map((article, i) => ({
                id: `news_${i}`,
                publisher: article.author || 'News Source',
                url: article.url,
                quote: article.text.substring(0, 300) + '...',
                score: 70,
                type: 'news' as const,
                publishedDate: article.published
              }));
              evidence.push(...newsEvidence);
              console.log(`✅ Found ${newsEvidence.length} news articles`);
            } else {
              console.log('ℹ️  No news results from Webz API, trying SERP fallback...');
              
              // ⚠️ FIX: Fallback to SERP for news
              const newsFromSerp = await this.getNewsFromSerp(newsQuery);
              evidence.push(...newsFromSerp);
            }
          } catch (newsError) {
            console.warn('⚠️  News API failed, using SERP fallback:', newsError);
            const newsFromSerp = await this.getNewsFromSerp(newsQuery);
            evidence.push(...newsFromSerp);
          }
        }
      }

      // Domain-Specific Search
      const claimType = this.detectClaimType(text);
      if (claimType !== 'general') {
        console.log(`🔬 Domain-specific search for ${claimType} claim`);
        const specializedResults = await this.performSpecializedSearch(text, claimType);
        evidence.push(...specializedResults);
        console.log(`✅ Found ${specializedResults.length} specialized sources`);
      }

      const avgScore = evidence.length > 0
        ? evidence.reduce((sum, e) => sum + e.score, 0) / evidence.length
        : 50;

      console.log(`✅ Phase 3 complete: ${evidence.length} additional sources (avg: ${avgScore.toFixed(1)}%)`);

      return {
        tier: 'specialized-analysis',
        success: evidence.length > 0,
        confidence: avgScore,
        evidence,
        shouldEscalate: true,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      console.warn('⚠️  Phase 3 failed:', error);
      return {
        tier: 'specialized-analysis',
        success: false,
        confidence: 50,
        evidence: [],
        shouldEscalate: true,
        processingTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ⚠️ NEW: Fallback news search using SERP
  private async getNewsFromSerp(query: string): Promise<EvidenceItem[]> {
    try {
      const newsQuery = `${query} news`;
      const results = await this.serpApi.search(newsQuery, 5);
      
      return results.results
        .filter(r => {
          const url = r.link?.toLowerCase() || '';
          return url.includes('news') || 
                 url.includes('reuters') || 
                 url.includes('apnews') ||
                 url.includes('bbc');
        })
        .map((r, i) => ({
          id: `news_serp_${i}`,
          publisher: r.source || 'News Source',
          url: r.link,
          quote: r.snippet || '',
          score: 65,
          type: 'news' as const
        }));
    } catch (error) {
      console.error('News SERP fallback failed:', error);
      return [];
    }
  }

  private async runPhase4Synthesis(
    text: string,
    baseReport: FactCheckReport,
    additionalEvidence: EvidenceItem[],
    publishingContext: PublishingContext
  ): Promise<TierResult & { report?: FactCheckReport }> {
    const startTime = Date.now();
    console.log('🧠 Phase 4: AI-Powered Synthesis');

    // ⚠️ FIX: Deduplicate evidence before synthesis
    const allEvidence = this.deduplicateEvidence([
      ...baseReport.evidence, 
      ...additionalEvidence
    ]);
    
    console.log(`📊 Synthesizing ${allEvidence.length} unique evidence items`);

    try {
      if (allEvidence.length === 0) {
        console.warn('⚠️  No evidence to synthesize - using empty report');
        return {
          tier: 'synthesis',
          success: false,
          confidence: 0,
          evidence: [],
          shouldEscalate: false,
          processingTime: Date.now() - startTime,
          report: {
            ...baseReport,
            final_verdict: 'INSUFFICIENT EVIDENCE',
            final_score: 0,
            reasoning: 'Unable to find sufficient evidence to verify this claim.',
            evidence: []
          }
        };
      }

      // ⚠️ FIX: Better Gemini synthesis with error handling
      let synthesisReport: FactCheckReport;
      
      try {
        synthesisReport = await synthesizeEvidenceWithGemini(text, allEvidence, publishingContext);
        console.log(`✅ Synthesis complete: ${synthesisReport.final_score}% confidence`);
      } catch (geminiError) {
        console.warn('⚠️  Gemini synthesis failed, using statistical fallback:', geminiError);
        synthesisReport = this.createStatisticalSynthesis(text, allEvidence, baseReport);
      }

      const finalReport: FactCheckReport = {
        ...baseReport,
        final_score: synthesisReport.final_score,
        final_verdict: synthesisReport.final_verdict,
        reasoning: synthesisReport.reasoning,
        evidence: allEvidence,
        score_breakdown: synthesisReport.score_breakdown,
        metadata: {
          ...baseReport.metadata,
          warnings: [
            ...baseReport.metadata.warnings,
            ...(synthesisReport.metadata?.warnings || [])
          ]
        }
      };

      return {
        tier: 'synthesis',
        success: true,
        confidence: synthesisReport.final_score,
        evidence: allEvidence,
        shouldEscalate: false,
        processingTime: Date.now() - startTime,
        report: finalReport
      };

    } catch (error) {
      console.error('❌ Phase 4 synthesis completely failed:', error);

      // Final fallback - statistical average
      const avgScore = allEvidence.length > 0
        ? Math.round(allEvidence.reduce((sum, e) => sum + e.score, 0) / allEvidence.length)
        : 0;

      return {
        tier: 'synthesis',
        success: allEvidence.length > 0,
        confidence: avgScore,
        evidence: allEvidence,
        shouldEscalate: false,
        processingTime: Date.now() - startTime,
        report: {
          ...baseReport,
          evidence: allEvidence,
          final_score: avgScore,
          final_verdict: this.generateVerdict(avgScore),
          reasoning: `Based on ${allEvidence.length} sources with average credibility of ${avgScore}%.`
        },
        error: error instanceof Error ? error.message : 'Synthesis failed'
      };
    }
  }

  // ⚠️ NEW: Statistical synthesis fallback
  private createStatisticalSynthesis(
    text: string, 
    evidence: EvidenceItem[], 
    baseReport: FactCheckReport
  ): FactCheckReport {
    const avgScore = Math.round(evidence.reduce((sum, e) => sum + e.score, 0) / evidence.length);
    const highCredSources = evidence.filter(e => e.score >= 75).length;
    const lowCredSources = evidence.filter(e => e.score < 50).length;

    let reasoning = `Analysis based on ${evidence.length} sources:\n`;
    reasoning += `- ${highCredSources} high-credibility sources (≥75%)\n`;
    reasoning += `- ${evidence.length - highCredSources - lowCredSources} medium-credibility sources\n`;
    reasoning += `- ${lowCredSources} lower-credibility sources (<50%)\n`;
    reasoning += `\nAverage credibility score: ${avgScore}%`;

    return {
      ...baseReport,
      final_score: avgScore,
      final_verdict: this.generateVerdict(avgScore),
      reasoning,
      evidence,
      score_breakdown: {
        final_score_formula: 'Statistical average of source credibility',
        metrics: [
          {
            name: 'Source Reliability',
            score: avgScore,
            description: `Weighted average of ${evidence.length} sources`
          },
          {
            name: 'Corroboration',
            score: (highCredSources / evidence.length) * 100,
            description: `${highCredSources} sources with ≥75% credibility`
          }
        ]
      }
    };
  }

  // ⚠️ NEW: Evidence deduplication
  private deduplicateEvidence(evidence: EvidenceItem[]): EvidenceItem[] {
    const seen = new Set<string>();
    const unique: EvidenceItem[] = [];

    evidence.forEach(item => {
      const key = item.url || `${item.publisher}-${item.quote.substring(0, 50)}`;
      const normalizedKey = key.toLowerCase().replace(/\/$/, '');
      
      if (!seen.has(normalizedKey)) {
        seen.add(normalizedKey);
        unique.push(item);
      }
    });

    return unique;
  }

  private shouldEscalate(phase: 1 | 2, result: TierResult): boolean {
    if (phase === 1) {
      return result.confidence < THRESHOLDS.phase1ToPhase2.minConfidence ||
             result.evidence.length < THRESHOLDS.phase1ToPhase2.minEvidence;
    } else {
      const avgScore = result.evidence.length > 0
        ? result.evidence.reduce((sum, e) => sum + e.score, 0) / result.evidence.length
        : 0;

      return result.confidence < THRESHOLDS.phase2ToPhase3.minConfidence ||
             result.evidence.length < THRESHOLDS.phase2ToPhase3.minEvidence ||
             avgScore < THRESHOLDS.phase2ToPhase3.minAvgScore;
    }
  }

  private extractSmartQuery(text: string, maxLength: number): string {
    const firstSentence = text.match(/^[^.!?]+[.!?]/)?.[0] || text;
    
    if (firstSentence.length <= maxLength) {
      return firstSentence.trim();
    }

    const truncated = firstSentence.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    return lastSpace > 0 ? truncated.substring(0, lastSpace) : truncated;
  }

  private extractRecentDate(text: string): string {
    // Try to extract year from text
    const yearMatch = text.match(/\b20(2[0-9])\b/);
    if (yearMatch) {
      return `${yearMatch[0]}-01-01`;
    }
    
    // Default to 90 days ago
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    return ninetyDaysAgo.toISOString().split('T')[0];
  }

  private detectClaimType(text: string): 'medical' | 'political' | 'scientific' | 'financial' | 'general' {
    const lower = text.toLowerCase();
    
    if (/vaccine|covid|virus|disease|treatment|medicine|health|cdc|who/i.test(lower)) return 'medical';
    if (/president|election|vote|government|policy|congress|senate/i.test(lower)) return 'political';
    if (/research|study|scientist|climate|global warming|experiment/i.test(lower)) return 'scientific';
    if (/stock|economy|inflation|market|financial|investment|gdp/i.test(lower)) return 'financial';
    
    return 'general';
  }

  private async performSpecializedSearch(text: string, claimType: string): Promise<EvidenceItem[]> {
    const query = this.extractSmartQuery(text, 80);
    
    const siteOperators = {
      medical: 'site:cdc.gov OR site:who.int OR site:nih.gov',
      political: 'site:factcheck.org OR site:politifact.com',
      scientific: 'site:nature.com OR site:science.org OR site:arxiv.org',
      financial: 'site:sec.gov OR site:federalreserve.gov',
      general: ''
    };

    try {
      const searchQuery = `${query} ${siteOperators[claimType as keyof typeof siteOperators] || ''}`;
      const results = await this.serpApi.search(searchQuery, 5);

      return results.results.map((r, i) => ({
        id: `specialized_${i}`,
        publisher: r.source || 'Unknown',
        url: r.link,
        quote: r.snippet || '',
        score: this.calculateSourceScore(r.source) + 10,
        type: 'search_result' as const
      }));
    } catch (error) {
      console.error('Specialized search failed:', error);
      return [];
    }
  }

  private async fallbackBasicSearch(text: string): Promise<FactCheckReport> {
    console.log('🔄 Using basic fallback search');
    const query = this.extractSmartQuery(text, 100);
    
    try {
      const results = await this.serpApi.search(query, 10);
      const evidence = results.results.slice(0, 8).map((r, i) => ({
        id: `fallback_${i}`,
        publisher: r.source || 'Unknown',
        url: r.link,
        quote: r.snippet || '',
        score: this.calculateSourceScore(r.source),
        type: 'search_result' as const
      }));

      const avgScore = evidence.length > 0
        ? Math.round(evidence.reduce((sum, e) => sum + e.score, 0) / evidence.length)
        : 0;

      return {
        id: `fallback_${Date.now()}`,
        originalText: text,
        final_verdict: this.generateVerdict(avgScore),
        final_score: avgScore,
        reasoning: `Fallback search found ${evidence.length} sources with average credibility of ${avgScore}%.`,
        evidence,
        enhanced_claim_text: text,
        score_breakdown: {
          final_score_formula: 'Fallback weighted average',
          metrics: [{
            name: 'Source Reliability',
            score: avgScore,
            description: `${evidence.length} sources analyzed`
          }]
        },
        metadata: {
          method_used: 'fallback-search',
          processing_time_ms: 0,
          apis_used: ['serp-api'],
          sources_consulted: { 
            total: evidence.length, 
            high_credibility: evidence.filter(e => e.score >= 75).length,
            conflicting: 0 
          },
          warnings: ['Pipeline failed - using fallback search']
        },
        source_credibility_report: {
          overallScore: avgScore,
          highCredibilitySources: evidence.filter(e => e.score >= 75).length,
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
    } catch (error) {
      throw new Error(`Fallback search failed: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  private calculateSourceScore(source: string): number {
    const lower = (source || '').toLowerCase();
    
    if (/reuters|ap\.org|apnews|bbc/i.test(lower)) return 85;
    if (/factcheck|snopes|politifact/i.test(lower)) return 85;
    if (/nytimes|washingtonpost|wsj|theguardian/i.test(lower)) return 75;
    if (/\.gov|\.edu/i.test(lower)) return 80;
    if (/cnn|abc|nbc|cbs/i.test(lower)) return 70;
    if (/wikipedia/i.test(lower)) return 55;
    if (/reddit|quora|twitter|facebook/i.test(lower)) return 30;
    
    return 50;
  }

  private convertRatingToScore(rating: any): number {
    if (!rating) return 50;

    const textualRating = (rating.textualRating || '').toLowerCase();
    if (textualRating.includes('true')) return 90;
    if (textualRating.includes('mostly true')) return 75;
    if (textualRating.includes('mixed')) return 50;
    if (textualRating.includes('mostly false')) return 25;
    if (textualRating.includes('false')) return 10;

    if (rating.ratingValue && rating.bestRating) {
      return Math.round((rating.ratingValue / rating.bestRating) * 100);
    }

    return 50;
  }

  private generateVerdict(score: number): string {
    if (score === 0) return 'UNVERIFIED - No Evidence';
    if (score >= 85) return 'TRUE - Highly Verified';
    if (score >= 70) return 'MOSTLY TRUE - Well Supported';
    if (score >= 50) return 'MIXED - Partial Accuracy';
    if (score >= 30) return 'MOSTLY FALSE - Limited Support';
    return 'FALSE - Contradicted by Evidence';
  }

  private buildReportFromPhase1(
    text: string,
    reportId: string,
    phase1: TierResult,
    tiers: TierResult[],
    startTime: number
  ): FactCheckReport {
    return {
      id: reportId,
      originalText: text,
      final_verdict: this.generateVerdict(phase1.confidence),
      final_score: phase1.confidence,
      reasoning: `Direct fact-check verification found ${phase1.evidence.length} authoritative sources with ${phase1.confidence.toFixed(1)}% confidence.`,
      evidence: phase1.evidence,
      enhanced_claim_text: text,
      score_breakdown: {
        final_score_formula: 'Phase 1: Direct fact-check average',
        metrics: [{
          name: 'Source Reliability',
          score: phase1.confidence,
          description: `${phase1.evidence.length} authoritative fact-check results`
        }]
      },
      metadata: {
        method_used: 'tiered-verification',
        processing_time_ms: Date.now() - startTime,
        apis_used: ['google-fact-check'],
        sources_consulted: {
          total: phase1.evidence.length,
          high_credibility: phase1.evidence.filter(e => e.score >= 80).length,
          conflicting: 0
        },
        warnings: phase1.confidence < 70 ? ['Moderate confidence - consider additional verification'] : [],
        tier_breakdown: tiers.map(t => ({
          tier: t.tier,
          success: t.success,
          confidence: t.confidence,
          processing_time_ms: t.processingTime,
          evidence_count: t.evidence.length
        }))
      },
      source_credibility_report: {
        overallScore: phase1.confidence,
        highCredibilitySources: phase1.evidence.filter(e => e.score >= 80).length,
        flaggedSources: 0,
        biasWarnings: [],
        credibilityBreakdown: { academic: 0, news: 0, government: 0, social: 0 }
      },
      temporal_verification: {
        hasTemporalClaims: false,
        validations: [],
        overallTemporalScore: 100,
        temporalWarnings: []
      }
    };
  }

  private enrichReportWithTierData(
    report: FactCheckReport,
    tiers: TierResult[],
    startTime: number
  ): FactCheckReport {
    return {
      ...report,
      metadata: {
        ...report.metadata,
        processing_time_ms: Date.now() - startTime,
        tier_breakdown: tiers.map(t => ({
          tier: t.tier,
          success: t.success,
          confidence: t.confidence,
          processing_time_ms: t.processingTime,
          evidence_count: t.evidence.length,
          metadata: t.metadata
        }))
      }
    };
  }

  private async uploadReportToBlob(report: FactCheckReport): Promise<void> {
    try {
      await this.blobStorage.saveReport({
        id: report.id,
        originalText: report.originalText,
        report,
        corrections: [],
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to upload to blob:', error);
    }
  }

  private createErrorReport(
    text: string,
    reportId: string,
    error: any,
    processingTime: number
  ): FactCheckReport {
    return {
      id: reportId,
      originalText: text,
      final_verdict: 'ANALYSIS ERROR',
      final_score: 0,
      evidence: [],
      reasoning: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      enhanced_claim_text: text,
      score_breakdown: {
        final_score_formula: 'Error',
        metrics: []
      },
      metadata: {
        method_used: 'tiered-verification-error',
        processing_time_ms: processingTime,
        apis_used: ['error-handler'],
        sources_consulted: { total: 0, high_credibility: 0, conflicting: 0 },
        warnings: [`Critical error: ${error instanceof Error ? error.message : 'Unknown'}`]
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
