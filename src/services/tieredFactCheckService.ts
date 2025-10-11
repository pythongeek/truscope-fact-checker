// src/services/tieredFactCheckService.ts - REFACTORED CORRECTLY
// Integrates synthesizer to drive search phases and implements the new data model.

import { FactCheckReport, EvidenceItem, PublishingContext, TieredFactCheckResult, ClaimVerificationResult, SearchPhaseResult, Evidence } from '@/types';
import { getSourceReliability } from '../data/sourceReliability';
import { GoogleFactCheckService } from './googleFactCheckService';
import { SerpApiService } from './serpApiService';
import { WebzNewsService } from './webzNewsService';
import { AdvancedCacheService } from './advancedCacheService';
import { BlobStorageService } from './blobStorage';
import { EnhancedFactCheckService } from './EnhancedFactCheckService';
import { generateSHA256 } from '../utils/hashUtils';
import { PerformanceMonitor } from './performanceMonitor';
import { generateTextWithFallback } from './geminiService';
import { simpleIntelligentQuerySynthesizer } from './analysis/SimpleIntelligentQuerySynthesizer';
import { logger } from '../utils/logger';

export type FactCheckTier = 'direct-verification' | 'pipeline-search' | 'specialized-web-search' | 'news-search' | 'synthesis';

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
  searchPhaseResult?: SearchPhaseResult<any>;
  report?: FactCheckReport;
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
    const operationId = await generateSHA256(`tiered_${claimText}_${startTime}`);
    logger.info('🎯 Starting Refactored Tiered Fact Check with Synthesized Queries', { claimText, publishingContext });

    // Generate queries to be used by all phases
    const { keywordQuery, contextualQuery } = await simpleIntelligentQuerySynthesizer.generateQueries(claimText);

    const tierResults: TierResult[] = [];
    let allEvidence: EvidenceItem[] = [];
    let finalSynthesizedReport: FactCheckReport | null = null;

    try {
      // Phase 1: Direct Fact-Check using keywordQuery
      const phase1Result = await this.runPhase1DirectVerification(keywordQuery);
      tierResults.push(phase1Result);
      allEvidence.push(...phase1Result.evidence);

      let phase2Result: TierResult | null = null;
      if (this.shouldEscalate(1, phase1Result)) {
        // Phase 2: Advanced Pipeline (uses its own internal query logic but could be enhanced)
        phase2Result = await this.runPhase2AdvancedPipeline(claimText);
        tierResults.push(phase2Result);
        allEvidence.push(...phase2Result.evidence);

        const hasGoodEvidence = phase2Result.evidence.length >= 3 && phase2Result.confidence >= 60;
        if ((!hasGoodEvidence || this.shouldEscalate(2, phase2Result)) && phase2Result.report) {
          // Phase 3a: News Search
          const phase3aResult = await this.runPhase3aNewsSearch(keywordQuery, claimText);
          tierResults.push(phase3aResult);
          allEvidence.push(...phase3aResult.evidence);

          // Phase 3b: Specialized Web Search
          const phase3bResult = await this.runPhase3bSpecializedWebSearch(contextualQuery, claimText);
          tierResults.push(phase3bResult);
          allEvidence.push(...phase3bResult.evidence);
        }
      }

      // Phase 4: Final Synthesis (always run if there's evidence)
      if (allEvidence.length > 0) {
        // Use the report from phase 2 if available, otherwise create a base report
        const baseReportForSynthesis = phase2Result?.report || this.createBaseReport(operationId, claimText, allEvidence);
        const phase4Result = await this.runPhase4Synthesis(claimText, baseReportForSynthesis, allEvidence, publishingContext);
        tierResults.push(phase4Result);
        finalSynthesizedReport = phase4Result.report || baseReportForSynthesis;
      } else {
        finalSynthesizedReport = this.createBaseReport(operationId, claimText, []);
        finalSynthesizedReport.final_verdict = "Uncertain";
      }

      // Construct the final TieredFactCheckResult
      const finalScore = finalSynthesizedReport?.final_score ?? 0;
      const finalVerdict = finalSynthesizedReport?.final_verdict ?? "Uncertain";
      const finalReasoning = finalSynthesizedReport?.reasoning ?? "Analysis could not be completed.";

      // 1. Process Evidence with Credibility Scores
      const processedEvidence: Evidence[] = this.deduplicateEvidence(allEvidence).map(e => {
        const reliability = getSourceReliability(e.publisher);
        const url = new URL(e.url || 'http://placeholder.com');
        return {
          id: e.id,
          url: e.url || '',
          title: e.quote.substring(0, 50), // Placeholder for title
          snippet: e.quote,
          publisher: e.publisher,
          publicationDate: e.publishedDate,
          credibilityScore: reliability ? reliability.reliabilityScore : 50, // Default score
          relevanceScore: 0, // Placeholder, AI will fill this in
        };
      });

      // 2. Construct the AI Analysis Prompt
      const analysisPrompt = `
        You are a meticulous fact-checking analyst. Your task is to analyze a claim based on the provided evidence and return a single, minified JSON object. Do not include any text outside of the JSON object.

        Claim: "${claimText}"

        Evidence:
        ${JSON.stringify(processedEvidence.map(e => ({ publisher: e.publisher, credibility: e.credibilityScore, snippet: e.snippet })), null, 2)}

        Based *only* on the evidence, determine the final verification status. Your response MUST be a single, valid, minified JSON object with the following structure:
        {
          "status": "...", // Choose one: "Verified", "Unverified", "Misleading", "Accurate", "Needs Context"
          "confidenceScore": 0.0, // A float between 0.0 and 1.0
          "explanation": "...", // A 1-2 sentence neutral explanation for your verdict.
          "reasoning": {
            "supportingSources": 0, // Count of sources that directly support the claim.
            "conflictingSources": 0, // Count of sources that directly conflict with the claim.
            "conclusion": "..." // Brief summary of the reasoning process. Example: 'Verdict is based on multiple high-credibility sources that corroborate the claim, with no significant conflicting evidence found.'
          },
          "evidenceWithRelevance": [
            { "url": "...", "relevanceScore": 0 } // For each piece of evidence, provide its original URL and a relevanceScore (0-100) to the claim.
          ]
        }
      `;

      // 3. Call Gemini and Parse the Structured JSON
      let claimVerifications: ClaimVerificationResult[];
      try {
        const analysisResultJson = await generateTextWithFallback(analysisPrompt, { maxOutputTokens: 2048 });
        // Robustly parse the JSON, cleaning up potential markdown formatting
        const cleanedJson = analysisResultJson.replace(/```json|```/g, '').trim();
        const analysisResult = JSON.parse(cleanedJson);

        // 4. Map the AI's response back to your data model
        const evidenceWithRelevance = new Map(analysisResult.evidenceWithRelevance.map((item: { url: string; relevanceScore: number; }) => [item.url, item.relevanceScore]));

        const finalEvidence: Evidence[] = processedEvidence.map(e => ({
          ...e,
          relevanceScore: evidenceWithRelevance.get(e.url) || 0,
        }));

        claimVerifications = [{
          id: `claim-${operationId}`,
          claimText: claimText,
          evidence: finalEvidence,
          status: analysisResult.status,
          confidenceScore: analysisResult.confidenceScore,
          explanation: analysisResult.explanation,
          reasoning: {
              ...analysisResult.reasoning,
              totalSources: finalEvidence.length,
          },
        }];

      } catch (error) {
        console.error("Failed to parse AI analysis response:", error);
        claimVerifications = [{
            id: `claim-${operationId}`,
            claimText: claimText,
            status: 'Error',
            confidenceScore: 0,
            explanation: "Failed to get a valid analysis from the AI model.",
            reasoning: {
                totalSources: processedEvidence.length,
                supportingSources: 0,
                conflictingSources: 0,
                conclusion: "The AI analysis step failed. This could be due to a model error or invalid response format."
            },
            evidence: processedEvidence,
        }];
      }


      const result: TieredFactCheckResult = {
        id: operationId,
        timestamp: new Date().toISOString(),
        originalText: claimText,
        overallAuthenticityScore: finalScore,
        summary: finalReasoning,
        claimVerifications,
        searchPhases: {
          googleFactChecks: tierResults.find(t => t.tier === 'direct-verification')?.searchPhaseResult ?? { queryUsed: '', count: 0, rawResults: [] },
          webSearches: tierResults.find(t => t.tier === 'specialized-web-search')?.searchPhaseResult ?? { queryUsed: '', count: 0, rawResults: [] },
          newsSearches: tierResults.find(t => t.tier === 'news-search')?.searchPhaseResult ?? { queryUsed: '', count: 0, rawResults: [] },
        },
      };

      if (finalSynthesizedReport && finalSynthesizedReport.evidence.length > 0) {
        await this.uploadReportToBlob(finalSynthesizedReport);
      }

      logger.info('Tiered fact-check completed successfully.');
      return {
        id: operationId,
        originalText: claimText,
        summary: finalReasoning,
        overallAuthenticityScore: finalScore,
        claimVerifications,
        metadata: {}
      };

    } catch (error) {
      logger.error('❌ Tiered fact check failed:', error);
      // Return an error structure for FactCheckReport
      return {
        id: operationId,
        originalText: claimText,
        summary: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        overallAuthenticityScore: 0,
        claimVerifications: [],
        metadata: {}
      };
    }
  }

  private createBaseReport(id: string, text: string, evidence: EvidenceItem[]): FactCheckReport {
    const score = evidence.length > 0 ? Math.round(evidence.reduce((sum, e) => sum + e.score, 0) / evidence.length) : 0;
    return {
      id,
      originalText: text,
      final_verdict: this.generateVerdict(score) as any,
      final_score: score,
      reasoning: `Report based on ${evidence.length} sources.`,
      evidence,
      enhanced_claim_text: text,
      score_breakdown: { 'Initial score': { score: 0, reasoning: ''} },
      metadata: { method_used: 'tiered-verification', processing_time_ms: 0, apis_used: [], sources_consulted: { total: evidence.length, high_credibility: 0, conflicting: 0 }, warnings: [] },
      source_credibility_report: { overallScore: score, highCredibilitySources: 0, flaggedSources: 0, biasWarnings: [], credibilityBreakdown: { academic: 0, news: 0, government: 0, social: 0 } },
      temporal_verification: { hasTemporalClaims: false, validations: [], overallTemporalScore: 0, temporalWarnings: [] }
    };
  }

  private mapVerdictToStatus(verdict: string): ClaimVerificationResult['status'] {
    const lowerVerdict = verdict.toLowerCase();
    if (lowerVerdict.includes('true')) return 'Accurate';
    if (lowerVerdict.includes('false')) return 'Misleading';
    if (lowerVerdict.includes('mixed')) return 'Needs Context';
    if (lowerVerdict.includes('unverified')) return 'Unverified';
    return 'Unverified';
  }

  private async runPhase1DirectVerification(keywordQuery: string): Promise<TierResult> {
    const startTime = Date.now();
    console.log('🔍 Phase 1: Direct Fact-Check Query:', keywordQuery);

    try {
      const report = await this.googleFactCheck.searchClaims(keywordQuery, 5);
      if (!report || report.evidence.length === 0) {
        return {
          tier: 'direct-verification', success: false, confidence: 0, evidence: [], shouldEscalate: true, processingTime: Date.now() - startTime, searchPhaseResult: { queryUsed: keywordQuery, count: 0, rawResults: [] }
        };
      }
      return {
        tier: 'direct-verification', success: true, confidence: report.final_score, evidence: report.evidence, shouldEscalate: report.final_score < THRESHOLDS.phase1ToPhase2.minConfidence, processingTime: Date.now() - startTime, searchPhaseResult: { queryUsed: keywordQuery, count: report.evidence.length, rawResults: report.evidence }
      };
    } catch (error) {
      return {
        tier: 'direct-verification', success: false, confidence: 0, evidence: [], shouldEscalate: true, processingTime: Date.now() - startTime, error: error instanceof Error ? error.message : 'Unknown error', searchPhaseResult: { queryUsed: keywordQuery, count: 0, rawResults: [] }
      };
    }
  }

  private async runPhase2AdvancedPipeline(text: string): Promise<TierResult> {
    const startTime = Date.now();
    console.log('🚀 Phase 2: Advanced Query Pipeline Analysis');
    try {
      const report = await this.enhancedService.orchestrateFactCheck(text, 'comprehensive');
      const evidenceCount = report.evidence.length;
      const avgScore = evidenceCount > 0 ? report.evidence.reduce((sum, e) => sum + e.score, 0) / evidenceCount : 0;
      const shouldEscalate = evidenceCount < THRESHOLDS.phase2ToPhase3.minEvidence || avgScore < THRESHOLDS.phase2ToPhase3.minAvgScore || report.final_score < THRESHOLDS.phase2ToPhase3.minConfidence;

      return {
        tier: 'pipeline-search', success: evidenceCount > 0, confidence: report.final_score, evidence: report.evidence, shouldEscalate, processingTime: Date.now() - startTime, report, metadata: { queriesExecuted: (report.metadata as any).pipelineMetadata?.queriesExecuted || 0, pipelineUsed: true }, searchPhaseResult: { queryUsed: 'Advanced Pipeline', count: evidenceCount, rawResults: report.evidence }
      };
    } catch (error) {
      const fallbackResult = await this.fallbackBasicSearch(text);
      return {
        tier: 'pipeline-search', success: fallbackResult.evidence.length > 0, confidence: fallbackResult.final_score, evidence: fallbackResult.evidence, shouldEscalate: true, processingTime: Date.now() - startTime, report: fallbackResult, error: `Pipeline failed, used fallback: ${error instanceof Error ? error.message : 'Unknown'}`
      };
    }
  }

  private async runPhase3aNewsSearch(keywordQuery: string, text: string): Promise<TierResult> {
    const startTime = Date.now();
    console.log('🎯 Phase 3a: News Search with Keyword Query');
    const evidence: EvidenceItem[] = [];
    let queryUsed = '';

    try {
      if (keywordQuery) {
        queryUsed = keywordQuery;
        const newsResults = await this.newsService.searchNews({ query: keywordQuery, fromDate: this.extractRecentDate(text) });
        if (newsResults?.posts?.length > 0) {
          evidence.push(...newsResults.posts.slice(0, 5).map((article, i) => ({
            id: `news_${i}`, publisher: article.author || 'News Source', url: article.url, quote: article.text.substring(0, 300) + '...', score: 70, type: 'news' as const, publishedDate: article.published
          })));
        } else {
          const newsFromSerp = await this.getNewsFromSerp(keywordQuery);
          evidence.push(...newsFromSerp);
        }
      }

      const avgScore = evidence.length > 0 ? evidence.reduce((sum, e) => sum + e.score, 0) / evidence.length : 50;
      return {
        tier: 'news-search', success: evidence.length > 0, confidence: avgScore, evidence, shouldEscalate: false, processingTime: Date.now() - startTime, searchPhaseResult: { queryUsed, count: evidence.length, rawResults: evidence }
      };
    } catch (error) {
      return {
        tier: 'news-search', success: false, confidence: 0, evidence: [], shouldEscalate: true, processingTime: Date.now() - startTime, error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async runPhase3bSpecializedWebSearch(contextualQuery: string, text: string): Promise<TierResult> {
    const startTime = Date.now();
    console.log('🎯 Phase 3b: Specialized Web Search with Contextual Query');
    const evidence: EvidenceItem[] = [];
    let queryUsed = '';

    try {
      const claimType = this.detectClaimType(text);
      if (claimType !== 'general' && contextualQuery) {
        const specializedResults = await this.performSpecializedSearch(contextualQuery, claimType);
        evidence.push(...specializedResults.evidence);
        queryUsed = specializedResults.query;
      }

      const avgScore = evidence.length > 0 ? evidence.reduce((sum, e) => sum + e.score, 0) / evidence.length : 50;
      return {
        tier: 'specialized-web-search', success: evidence.length > 0, confidence: avgScore, evidence, shouldEscalate: false, processingTime: Date.now() - startTime, searchPhaseResult: { queryUsed, count: evidence.length, rawResults: evidence }
      };
    } catch (error) {
      return {
        tier: 'specialized-web-search', success: false, confidence: 0, evidence: [], shouldEscalate: true, processingTime: Date.now() - startTime, error: error instanceof Error ? error.message : 'Unknown error'
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
            final_verdict: 'Uncertain',
            final_score: 0,
            reasoning: 'Unable to find sufficient evidence to verify this claim.',
            evidence: []
          }
        };
      }

      // ⚠️ FIX: Better Gemini synthesis with error handling
      let synthesisReport: FactCheckReport;
      
      try {
        synthesisReport = await this._synthesizeEvidenceWithGemini(text, allEvidence, publishingContext);
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
            ...(baseReport.metadata.warnings ?? []),
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
        'Source Reliability': {
            score: avgScore,
            reasoning: `Weighted average of ${evidence.length} sources`
          },
        'Corroboration': {
            score: (highCredSources / evidence.length) * 100,
            reasoning: `${highCredSources} sources with ≥75% credibility`
          }
      }
    };
  }

  private async _synthesizeEvidenceWithGemini(
    originalClaim: string,
    evidence: any[],
    publishingContext: PublishingContext
  ): Promise<FactCheckReport> {
    const evidenceSummary = evidence
      .slice(0, 15)
      .map((e, i) => `[Source ${i + 1} - ${e.publisher} - Credibility: ${e.score}%]: "${e.quote}"`)
      .join('\n');

    const prompt = `
As an expert fact-checker, analyze the following claim based on the provided evidence.
Your analysis must be objective, impartial, and strictly based on the sources.

**Claim:** "${originalClaim}"

**Publishing Context:** ${publishingContext}

**Evidence:**
${evidenceSummary}

**Your Task:**
Provide a final verdict and a numerical score (0-100).
Explain your reasoning clearly and concisely.
Output MUST be valid JSON in this exact format:

{
  "final_verdict": "...",
  "final_score": ...,
  "reasoning": "...",
  "score_breakdown": {
    "final_score_formula": "Weighted analysis of source credibility and corroboration.",
    "metrics": [
      {
        "name": "Source Reliability",
        "score": ...,
        "description": "Average credibility of provided sources."
      },
      {
        "name": "Corroboration",
        "score": ...,
        "description": "Degree to which sources confirm each other."
      }
    ]
  }
}
`;

    const jsonString = await generateTextWithFallback(prompt, { maxOutputTokens: 1500, apiKey: process.env.GEMINI_API_KEY || '' });
    const cleanedJson = jsonString.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleanedJson);

    if (!result.final_verdict || typeof result.final_score !== 'number') {
      throw new Error('Invalid JSON structure from Gemini');
    }

    return {
      ...result,
      final_verdict: result.final_verdict as any,
    } as FactCheckReport;
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

  private async performSpecializedSearch(text: string, claimType: string): Promise<{ evidence: EvidenceItem[], query: string }> {
    const query = this.extractSmartQuery(text, 80);
    
    const siteOperators = {
      medical: 'site:cdc.gov OR site:who.int OR site:nih.gov',
      political: 'site:factcheck.org OR site:politifact.com',
      scientific: 'site:nature.com OR site:science.org OR site:arxiv.org',
      financial: 'site:sec.gov OR site:federalreserve.gov',
      general: ''
    };

    const searchQuery = `${query} ${siteOperators[claimType as keyof typeof siteOperators] || ''}`.trim();

    try {
      const results = await this.serpApi.search(searchQuery, 5);

      const evidence = results.results.map((r, i) => ({
        id: `specialized_${i}`,
        publisher: r.source || 'Unknown',
        url: r.link,
        title: r.title,
        snippet: r.snippet || '',
        source: r.source,
        quote: r.snippet || '',
        score: this.calculateSourceScore(r.source) + 10,
        type: 'search_result' as const
      }));
      return { evidence, query: searchQuery };
    } catch (error) {
      console.error('Specialized search failed:', error);
      return { evidence: [], query: searchQuery };
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
        title: r.title,
        snippet: r.snippet || '',
        source: r.source,
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
            'Source Reliability': {
                score: avgScore,
                reasoning: `${evidence.length} sources analyzed`
            }
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

  private generateVerdict(score: number): any {
    if (score === 0) return 'Uncertain';
    if (score >= 85) return 'TRUE';
    if (score >= 70) return 'MOSTLY TRUE';
    if (score >= 50) return 'MIXED';
    if (score >= 30) return 'MOSTLY FALSE';
    return 'FALSE';
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
        'Source Reliability': {
            score: phase1.confidence,
            reasoning: `${phase1.evidence.length} authoritative fact-check results`
        }
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
      final_verdict: 'ANALYSIS ERROR' as any,
      final_score: 0,
      evidence: [],
      reasoning: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      enhanced_claim_text: text,
      score_breakdown: {
        'Error': {
            score: 0,
            reasoning: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
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
