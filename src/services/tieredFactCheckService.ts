// src/services/tieredFactCheckService.ts - FULLY FIXED
// All TypeScript errors resolved while preserving all functionality

import {
  FactCheckReport,
  EvidenceItem,
  PublishingContext,
  ClaimVerificationResult,
  Evidence,
  ScoreBreakdown,
  FactCheckMetadata,
  FactVerdict
} from '@/types';
import { completeFactCheckReport, createErrorReport as createErrorHelper } from '@/types/helpers';
import { getSourceReliability } from '../data/sourceReliability';
import { GoogleFactCheckService } from './googleFactCheckService';
import { SerpApiService, SerpApiResult } from './serpApiService';
import { WebzNewsService } from './webzNewsService';
import { AdvancedCacheService } from './advancedCacheService';
import { BlobStorageService, StoredReport } from './blobStorage';
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
  searchPhaseResult?: any;
  report?: FactCheckReport;
}

const THRESHOLDS = {
  phase1ToPhase2: { minConfidence: 75, minEvidence: 2 },
  phase2ToPhase3: { minConfidence: 60, minEvidence: 2, minAvgScore: 55 }
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
    const operationId = await generateSHA256(claimText + startTime);
    logger.info(`Starting tiered fact-check for claim: "${claimText}" (ID: ${operationId})`);

    const { keywordQuery, contextualQuery } = await simpleIntelligentQuerySynthesizer.generateQueries(claimText);

    const tierResults: TierResult[] = [];
    let allEvidence: EvidenceItem[] = [];
    let finalSynthesizedReport: FactCheckReport | null = null;

    try {
      const phase1Result = await this.runPhase1DirectVerification(keywordQuery);
      tierResults.push(phase1Result);
      allEvidence.push(...phase1Result.evidence);

      let phase2Result: TierResult | null = null;
      if (this.shouldEscalate(1, phase1Result)) {
        phase2Result = await this.runPhase2AdvancedPipeline(claimText);
        tierResults.push(phase2Result);
        allEvidence.push(...phase2Result.evidence);

        const hasGoodEvidence = phase2Result.evidence.length >= 3 && phase2Result.confidence >= 60;
        if ((!hasGoodEvidence || this.shouldEscalate(2, phase2Result)) && phase2Result.report) {
          const phase3aResult = await this.runPhase3aNewsSearch(keywordQuery, claimText);
          tierResults.push(phase3aResult);
          allEvidence.push(...phase3aResult.evidence);

          const phase3bResult = await this.runPhase3bSpecializedWebSearch(contextualQuery, claimText);
          tierResults.push(phase3bResult);
          allEvidence.push(...phase3bResult.evidence);
        }
      }

      if (allEvidence.length > 0) {
        const baseReportForSynthesis = phase2Result?.report || this.createBaseReport(operationId, claimText, allEvidence);
        const phase4Result = await this.runPhase4Synthesis(claimText, baseReportForSynthesis, allEvidence, publishingContext);
        tierResults.push(phase4Result);
        finalSynthesizedReport = phase4Result.report || baseReportForSynthesis;
      } else {
        finalSynthesizedReport = this.createBaseReport(operationId, claimText, []);
        finalSynthesizedReport.finalVerdict = 'UNVERIFIED';
      }

      const finalScore = finalSynthesizedReport?.finalScore ?? 0;
      const finalVerdict = finalSynthesizedReport?.finalVerdict ?? 'UNVERIFIED';
      const finalReasoning = finalSynthesizedReport?.reasoning ?? "Analysis could not be completed.";

      const processedEvidence: Evidence[] = this.deduplicateEvidence(allEvidence).map(e => {
        const reliability = getSourceReliability(e.publisher);
        const quoteText = e.quote ?? e.snippet ?? '';
        return {
          id: e.id,
          url: e.url || '',
          title: e.title || quoteText.substring(0, 50),
          snippet: e.snippet || quoteText,
          publisher: e.publisher,
          publicationDate: e.publishedDate,
          credibilityScore: reliability ? reliability.reliabilityScore : 50,
          relevanceScore: 0,
          type: e.type,
          source: e.source,
          quote: quoteText,
          score: e.score,
          publishedDate: e.publishedDate
        };
      });

      const analysisPrompt = `
        You are a meticulous fact-checking analyst. Your task is to analyze a claim based on the provided evidence and return a single, minified JSON object. Do not include any text outside of the JSON object.

        Claim: "${claimText}"

        Evidence:
        ${JSON.stringify(processedEvidence.map(e => ({ publisher: e.publisher, credibility: e.credibilityScore, snippet: e.snippet })), null, 2)}

        Based *only* on the evidence, determine the final verification status. Your response MUST be a single, valid, minified JSON object with the following structure:
        {
          "status": "Verified" | "Unverified" | "Disputed" | "Retracted",
          "confidenceScore": 0.0,
          "explanation": "...",
          "reasoning": "...",
          "evidenceWithRelevance": [
            { "url": "...", "relevanceScore": 0 }
          ]
        }
      `;

      let claimVerifications: ClaimVerificationResult[];
      try {
        const analysisResultJson = await generateTextWithFallback(analysisPrompt, { apiKey: process.env.GEMINI_API_KEY, maxOutputTokens: 2048 });
        if (!analysisResultJson) {
          throw new Error('Gemini returned null response');
        }
        const cleanedJson = analysisResultJson.replace(/```json|```/g, '').trim();
        const analysisResult = JSON.parse(cleanedJson);

        const evidenceWithRelevance = new Map(analysisResult.evidenceWithRelevance.map((item: { url: string; relevanceScore: number; }) => [item.url, item.relevanceScore]));

        const finalEvidence: Evidence[] = processedEvidence.map(e => ({
          ...e,
          relevanceScore: Number(evidenceWithRelevance.get(e.url)) || 0,
        }));

        claimVerifications = [{
          id: `claim-${operationId}`,
          claimText: claimText,
          evidence: finalEvidence,
          status: analysisResult.status,
          confidenceScore: analysisResult.confidenceScore,
          explanation: analysisResult.explanation,
          reasoning: analysisResult.reasoning
        }];

      } catch (error) {
        console.error("Failed to parse AI analysis response:", error);
        claimVerifications = [{
          id: `claim-${operationId}`,
          claimText: claimText,
          status: 'Error',
          confidenceScore: 0,
          explanation: "Failed to get a valid analysis from the AI model.",
          reasoning: "The AI analysis step failed. This could be due to a model error or invalid response format.",
          evidence: processedEvidence,
        }];
      }

      const scoreBreakdown: ScoreBreakdown = {
        finalScoreFormula: finalSynthesizedReport?.scoreBreakdown?.finalScoreFormula || 'Default scoring',
        metrics: (finalSynthesizedReport?.scoreBreakdown?.metrics || []).map(m => ({
          name: m.name,
          score: m.score,
          weight: m.weight || 1.0,
          description: m.description,
          reasoning: m.reasoning
        })),
        confidenceIntervals: {
          lowerBound: finalSynthesizedReport?.scoreBreakdown?.confidenceIntervals?.lowerBound || 0,
          upperBound: finalSynthesizedReport?.scoreBreakdown?.confidenceIntervals?.upperBound || 0,
        }
      };

      const metadata: FactCheckMetadata = {
        methodUsed: finalSynthesizedReport?.metadata?.methodUsed || 'tiered-verification',
        processingTimeMs: Date.now() - startTime,
        apisUsed: finalSynthesizedReport?.metadata?.apisUsed || [],
        sourcesConsulted: {
          total: finalSynthesizedReport?.metadata?.sourcesConsulted?.total || 0,
          highCredibility: finalSynthesizedReport?.metadata?.sourcesConsulted?.highCredibility || 0,
          conflicting: finalSynthesizedReport?.metadata?.sourcesConsulted?.conflicting || 0,
        },
        warnings: finalSynthesizedReport?.metadata?.warnings || [],
      };

      const finalReport: FactCheckReport = {
        id: operationId,
        originalText: claimText,
        summary: finalReasoning,
        overallAuthenticityScore: finalScore,
        claimVerifications,
        finalScore: finalScore,
        finalVerdict: finalVerdict,
        reasoning: finalReasoning,
        evidence: allEvidence,
        scoreBreakdown: scoreBreakdown,
        metadata: metadata,
      };

      if (finalSynthesizedReport && finalSynthesizedReport.evidence.length > 0) {
        await this.uploadReportToBlob(finalSynthesizedReport);
      }

      logger.info('Tiered fact-check completed successfully.');
      return finalReport;

    } catch (error) {
      logger.error('❌ Tiered fact check failed:', error);
      return createErrorHelper(claimText, error as Error, 'tiered-fact-check');
    }
  }

  private createBaseReport(id: string, text: string, evidence: EvidenceItem[]): FactCheckReport {
    const score = evidence.length > 0 ? Math.round(evidence.reduce((sum, e) => sum + e.score, 0) / evidence.length) : 0;
    return completeFactCheckReport({
      id,
      originalText: text,
      finalVerdict: this.generateVerdict(score),
      finalScore: score,
      reasoning: `Report based on ${evidence.length} sources.`,
      evidence,
      enhancedClaimText: text,
    });
  }

  private async runPhase1DirectVerification(keywordQuery: string): Promise<TierResult> {
    const startTime = Date.now();
    try {
      const report = await this.googleFactCheck.searchClaims(keywordQuery, 5);
      if (!report || report.evidence.length === 0) {
        return {
          tier: 'direct-verification',
          success: false,
          confidence: 0,
          evidence: [],
          shouldEscalate: true,
          processingTime: Date.now() - startTime,
          searchPhaseResult: { queryUsed: keywordQuery, count: 0, rawResults: [] }
        };
      }
      return {
        tier: 'direct-verification',
        success: true,
        confidence: report.finalScore,
        evidence: report.evidence,
        shouldEscalate: report.finalScore < THRESHOLDS.phase1ToPhase2.minConfidence,
        processingTime: Date.now() - startTime,
        searchPhaseResult: { queryUsed: keywordQuery, count: report.evidence.length, rawResults: report.evidence }
      };
    } catch (error) {
      return {
        tier: 'direct-verification',
        success: false,
        confidence: 0,
        evidence: [],
        shouldEscalate: true,
        processingTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        searchPhaseResult: { queryUsed: keywordQuery, count: 0, rawResults: [] }
      };
    }
  }

  private async runPhase2AdvancedPipeline(text: string): Promise<TierResult> {
    const startTime = Date.now();
    try {
      const report = await this.enhancedService.orchestrateFactCheck(text, 'COMPREHENSIVE');
      const evidenceCount = report.evidence.length;
      const shouldEscalate = this.shouldEscalate(2, {
        tier: 'pipeline-search',
        success: evidenceCount > 0,
        confidence: report.finalScore,
        evidence: report.evidence,
        shouldEscalate: false,
        processingTime: 0
      });

      return {
        tier: 'pipeline-search',
        success: evidenceCount > 0,
        confidence: report.finalScore,
        evidence: report.evidence,
        shouldEscalate,
        processingTime: Date.now() - startTime,
        report,
        metadata: {
          queriesExecuted: (report.metadata as any).pipelineMetadata?.queriesExecuted || 0,
          pipelineUsed: true
        },
        searchPhaseResult: { queryUsed: 'Advanced Pipeline', count: evidenceCount, rawResults: report.evidence }
      };
    } catch (error) {
      const fallbackResult = await this.fallbackBasicSearch(text);
      return {
        tier: 'pipeline-search',
        success: fallbackResult.evidence.length > 0,
        confidence: fallbackResult.finalScore,
        evidence: fallbackResult.evidence,
        shouldEscalate: true,
        processingTime: Date.now() - startTime,
        report: fallbackResult,
        error: `Pipeline failed, used fallback: ${error instanceof Error ? error.message : 'Unknown'}`
      };
    }
  }

  private async runPhase3aNewsSearch(keywordQuery: string, text: string): Promise<TierResult> {
    const startTime = Date.now();
    const evidence: EvidenceItem[] = [];
    let queryUsed = 'Generic News Search';
    try {
      if (keywordQuery) {
        queryUsed = keywordQuery;
        const newsResults = await this.newsService.searchNews({ query: keywordQuery, fromDate: this.extractRecentDate(text) });
        if (newsResults?.posts?.length > 0) {
          evidence.push(...newsResults.posts.slice(0, 5).map((article: any, i: number) => {
            const url = new URL(article.url);
            const sourceName = url.hostname.replace(/^www\./, '');
            const rating: "High" | "Medium" | "Low" = "Medium";
            const articleText = article.text || '';
            const articleTitle = article.title || 'Untitled';
            const articlePublished = article.published || new Date().toISOString();
            const articleAuthor = article.author || 'News Source';
            
            return {
              id: `news_${i}`,
              publisher: articleAuthor,
              url: article.url,
              quote: articleText.substring(0, 300) + (articleText.length > 300 ? '...' : ''),
              score: 70,
              credibilityScore: 70,
              relevanceScore: 75,
              type: 'news' as const,
              publishedDate: articlePublished,
              title: articleTitle,
              snippet: articleText.substring(0, 150) + (articleText.length > 150 ? '...' : ''),
              source: {
                name: sourceName,
                url: url.origin,
                credibility: {
                  rating: rating,
                  classification: 'News Media',
                  warnings: [],
                },
              },
            };
          }));
        } else {
          const newsFromSerp = await this.getNewsFromSerp(keywordQuery);
          evidence.push(...newsFromSerp);
        }
      }

      const avgScore = evidence.length > 0 ? evidence.reduce((sum, e) => sum + e.score, 0) / evidence.length : 50;
      return {
        tier: 'news-search',
        success: evidence.length > 0,
        confidence: avgScore,
        evidence,
        shouldEscalate: false,
        processingTime: Date.now() - startTime,
        searchPhaseResult: { queryUsed, count: evidence.length, rawResults: evidence }
      };
    } catch (error) {
      return {
        tier: 'news-search',
        success: false,
        confidence: 0,
        evidence: [],
        shouldEscalate: true,
        processingTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async runPhase3bSpecializedWebSearch(contextualQuery: string, text: string): Promise<TierResult> {
    const startTime = Date.now();
    const evidence: EvidenceItem[] = [];
    let queryUsed = 'Generic Web Search';
    try {
      const claimType = this.detectClaimType(text);
      if (claimType !== 'general' && contextualQuery) {
        const specializedResults = await this.performSpecializedSearch(contextualQuery, claimType);
        evidence.push(...specializedResults.evidence);
        queryUsed = specializedResults.query;
      }

      const avgScore = evidence.length > 0 ? evidence.reduce((sum, e) => sum + e.score, 0) / evidence.length : 50;
      return {
        tier: 'specialized-web-search',
        success: evidence.length > 0,
        confidence: avgScore,
        evidence,
        shouldEscalate: false,
        processingTime: Date.now() - startTime,
        searchPhaseResult: { queryUsed, count: evidence.length, rawResults: evidence }
      };
    } catch (error) {
      return {
        tier: 'specialized-web-search',
        success: false,
        confidence: 0,
        evidence: [],
        shouldEscalate: true,
        processingTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

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
        .map((r: SerpApiResult, i: number) => {
          const url = new URL(r.link);
          const sourceName = url.hostname.replace(/^www\./, '');
          const rating: "High" | "Medium" | "Low" = "Medium";
          const snippet = r.snippet || 'No description available';
          const publishedDate = r.date || new Date().toISOString();
          
          return {
            id: `news_serp_${i}`,
            publisher: r.source || 'News Source',
            url: r.link,
            quote: snippet,
            score: 65,
            credibilityScore: 65,
            relevanceScore: 70,
            type: 'news' as const,
            title: r.title,
            snippet: snippet,
            publishedDate: publishedDate,
            source: {
              name: sourceName,
              url: url.origin,
              credibility: {
                rating: rating,
                classification: 'News Media',
                warnings: [],
              },
            },
          };
        });
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
            finalVerdict: 'UNVERIFIED',
            finalScore: 0,
            reasoning: 'Unable to find sufficient evidence to verify this claim.',
            evidence: []
          }
        };
      }

      let synthesisReport: FactCheckReport;

      try {
        synthesisReport = await this._synthesizeEvidenceWithGemini(text, allEvidence, publishingContext);
        console.log(`✅ Synthesis complete: ${synthesisReport.finalScore}% confidence`);
      } catch (geminiError) {
        console.warn('⚠️  Gemini synthesis failed, using statistical fallback:', geminiError);
        synthesisReport = this.createStatisticalSynthesis(text, allEvidence, baseReport);
      }

      const finalReport: FactCheckReport = {
        ...baseReport,
        finalScore: synthesisReport.finalScore,
        finalVerdict: synthesisReport.finalVerdict,
        reasoning: synthesisReport.reasoning,
        evidence: allEvidence,
        scoreBreakdown: synthesisReport.scoreBreakdown,
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
        confidence: synthesisReport.finalScore,
        evidence: allEvidence,
        shouldEscalate: false,
        processingTime: Date.now() - startTime,
        report: finalReport
      };

    } catch (error) {
      console.error('❌ Phase 4 synthesis completely failed:', error);

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
          finalScore: avgScore,
          finalVerdict: this.generateVerdict(avgScore),
          reasoning: `Based on ${allEvidence.length} sources with average credibility of ${avgScore}%.`
        },
        error: error instanceof Error ? error.message : 'Synthesis failed'
      };
    }
  }

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

    const scoreBreakdown: ScoreBreakdown = {
      finalScoreFormula: `Weighted average of ${evidence.length} sources`,
      metrics: [
        {
          name: 'Source Reliability',
          score: avgScore,
          weight: 0.6,
          description: `Weighted average of ${evidence.length} sources`,
          reasoning: 'The reliability score is the average of all sources.'
        },
        {
          name: 'Corroboration',
          score: (highCredSources / evidence.length) * 100,
          weight: 0.4,
          description: `${highCredSources} sources with ≥75% credibility`,
          reasoning: 'The corroboration score is based on the number of high-credibility sources.'
        }
      ],
      confidenceIntervals: {
        lowerBound: Math.max(0, avgScore - 10),
        upperBound: Math.min(100, avgScore + 10)
      }
    };

    return {
      ...baseReport,
      finalScore: avgScore,
      finalVerdict: this.generateVerdict(avgScore),
      reasoning,
      evidence,
      scoreBreakdown: scoreBreakdown
    };
  }

  private async _synthesizeEvidenceWithGemini(
    originalClaim: string,
    evidence: any[],
    publishingContext: PublishingContext
  ): Promise<FactCheckReport> {
    const evidenceSummary = JSON.stringify(evidence.map(e => ({
      source: e.publisher,
      url: e.url,
      quote: e.quote || e.snippet || '',
      score: e.score
    })).slice(0, 15), null, 2);

    const prompt = `
As an expert fact-checker, analyze the following claim based on the provided evidence. Your analysis must be objective, impartial, and strictly based on the sources.
Claim: "${originalClaim}"
Publishing Context: ${publishingContext}
Evidence: ${evidenceSummary}
Your Task: Provide a final verdict and a numerical score (0-100). Explain your reasoning clearly and concisely. Output MUST be valid JSON in this exact format:
{
  "finalVerdict": "TRUE" | "FALSE" | "MIXED" | "UNVERIFIED" | "MISLEADING",
  "finalScore": number (0-100),
  "reasoning": "...",
  "scoreBreakdown": {
    "finalScoreFormula": "Weighted analysis of source credibility and corroboration.",
    "metrics": [
      { "name": "Source Reliability", "score": number, "weight": 0.6, "description": "Average credibility of provided sources.", "reasoning": "..." },
      { "name": "Corroboration", "score": number, "weight": 0.4, "description": "Degree to which sources confirm each other.", "reasoning": "..." }
    ]
  }
}
`;

    const jsonString = await generateTextWithFallback(prompt, { maxOutputTokens: 1500, apiKey: process.env.GEMINI_API_KEY || '' });
    if (!jsonString) {
      throw new Error('Gemini returned null response');
    }
    const cleanedJson = jsonString.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleanedJson);

    if (!result.finalVerdict || typeof result.finalScore !== 'number') {
      throw new Error('Invalid JSON structure from Gemini');
    }

    return {
      ...result,
      finalVerdict: result.finalVerdict as FactVerdict,
    } as FactCheckReport;
  }

  private deduplicateEvidence(evidence: EvidenceItem[]): EvidenceItem[] {
    const seen = new Set<string>();
    const unique: EvidenceItem[] = [];

    evidence.forEach(item => {
      const quoteText = item.quote ?? item.snippet ?? '';
      const key = item.url || `${item.publisher}-${quoteText.substring(0, 50)}`;
      const normalizedKey = key.toLowerCase().replace(/\/$/, '');

      if (!seen.has(normalizedKey)) {
        seen.add(normalizedKey);
        unique.push(item);
      }
    });

    return unique;
  }

  // MISSING HELPER METHODS - NOW ADDED:

  private shouldEscalate(phase: number, result: TierResult): boolean {
    if (phase === 1) {
      return !result.success || 
             result.confidence < THRESHOLDS.phase1ToPhase2.minConfidence || 
             result.evidence.length < THRESHOLDS.phase1ToPhase2.minEvidence;
    }
    
    if (phase === 2) {
      const avgScore = result.evidence.length > 0 
        ? result.evidence.reduce((sum, e) => sum + e.score, 0) / result.evidence.length
        : 0;
      
      return !result.success ||
             result.confidence < THRESHOLDS.phase2ToPhase3.minConfidence ||
             result.evidence.length < THRESHOLDS.phase2ToPhase3.minEvidence ||
             avgScore < THRESHOLDS.phase2ToPhase3.minAvgScore;
    }
    
    return false;
  }

  private generateVerdict(score: number): FactVerdict {
    if (score >= 85) return 'TRUE';
    if (score >= 65) return 'MIXED';
    if (score >= 40) return 'MISLEADING';
    if (score >= 20) return 'FALSE';
    return 'UNVERIFIED';
  }

  private detectClaimType(text: string): string {
    const lowerText = text.toLowerCase();
    
    // Scientific claims
    if (lowerText.match(/\b(study|research|scientist|evidence|data|correlation|causation)\b/)) {
      return 'scientific';
    }
    
    // Medical/health claims
    if (lowerText.match(/\b(health|medical|disease|treatment|cure|vaccine|symptom)\b/)) {
      return 'medical';
    }
    
    // Political claims
    if (lowerText.match(/\b(president|senator|congress|policy|law|government|election)\b/)) {
      return 'political';
    }
    
    // Historical claims
    if (lowerText.match(/\b(history|historical|century|year|happened|occurred)\b/)) {
      return 'historical';
    }
    
    // Economic/financial claims
    if (lowerText.match(/\b(economy|economic|inflation|GDP|market|stock|finance)\b/)) {
      return 'economic';
    }
    
    return 'general';
  }

  private async performSpecializedSearch(query: string, claimType: string): Promise<{ evidence: EvidenceItem[]; query: string }> {
    let specializedQuery = query;
    let domainFilter = '';
    
    switch (claimType) {
      case 'scientific':
        specializedQuery = `${query} site:nature.com OR site:science.org OR site:pubmed.ncbi.nlm.nih.gov`;
        domainFilter = 'academic';
        break;
      case 'medical':
        specializedQuery = `${query} site:nih.gov OR site:who.int OR site:cdc.gov OR site:mayoclinic.org`;
        domainFilter = 'medical';
        break;
      case 'political':
        specializedQuery = `${query} site:congress.gov OR site:politifact.com OR site:factcheck.org`;
        domainFilter = 'political';
        break;
      case 'historical':
        specializedQuery = `${query} site:.edu OR site:history.com OR site:britannica.com`;
        domainFilter = 'historical';
        break;
      case 'economic':
        specializedQuery = `${query} site:bls.gov OR site:federalreserve.gov OR site:worldbank.org`;
        domainFilter = 'economic';
        break;
      default:
        specializedQuery = query;
    }

    try {
      const results = await this.serpApi.search(specializedQuery, 5);
      const evidence: EvidenceItem[] = results.results.map((r: SerpApiResult, i: number) => {
        const url = new URL(r.link);
        const sourceName = url.hostname.replace(/^www\./, '');
        const credScore = this.calculateSpecializedCredibility(sourceName, claimType);
        const rating: "High" | "Medium" | "Low" = credScore >= 80 ? "High" : credScore >= 60 ? "Medium" : "Low";
        
        return {
          id: `specialized_${claimType}_${i}`,
          publisher: r.source || sourceName,
          url: r.link,
          quote: r.snippet || '',
          score: credScore,
          credibilityScore: credScore,
          relevanceScore: 80,
          type: 'search_result' as const,
          title: r.title,
          snippet: r.snippet || '',
          publishedDate: r.date || new Date().toISOString(),
          source: {
            name: sourceName,
            url: url.origin,
            credibility: {
              rating: rating,
              classification: this.getClassification(domainFilter),
              warnings: [],
            },
          },
        };
      });

      return { evidence, query: specializedQuery };
    } catch (error) {
      console.error(`Specialized search failed for ${claimType}:`, error);
      return { evidence: [], query: specializedQuery };
    }
  }

  private calculateSpecializedCredibility(domain: string, claimType: string): number {
    const d = domain.toLowerCase();
    
    // Base credibility by domain type
    if (d.includes('.gov')) return 95;
    if (d.includes('.edu')) return 90;
    if (d.includes('nature.com') || d.includes('science.org')) return 98;
    if (d.includes('pubmed') || d.includes('nih.gov')) return 95;
    if (d.includes('who.int') || d.includes('cdc.gov')) return 93;
    if (d.includes('politifact.com') || d.includes('factcheck.org')) return 92;
    if (d.includes('reuters.com') || d.includes('apnews.com')) return 90;
    if (d.includes('bbc.com') || d.includes('pbs.org')) return 88;
    
    // Type-specific adjustments
    if (claimType === 'scientific' && d.includes('journal')) return 85;
    if (claimType === 'medical' && d.includes('clinic')) return 82;
    
    return 70; // Default for specialized sources
  }

  private getClassification(domainFilter: string): string {
    const classifications: Record<string, string> = {
      'academic': 'Academic/Scientific Source',
      'medical': 'Medical/Health Authority',
      'political': 'Political Fact-Checker',
      'historical': 'Historical Reference',
      'economic': 'Economic/Financial Authority'
    };
    
    return classifications[domainFilter] || 'Specialized Source';
  }

  private extractRecentDate(text: string): string {
    // Extract date from text or return recent date (last 90 days)
    const dateMatch = text.match(/\b(202[0-9]|201[5-9])\b/);
    if (dateMatch) {
      const year = parseInt(dateMatch[0]);
      const currentYear = new Date().getFullYear();
      if (year >= currentYear - 2) {
        return `${year}-01-01`;
      }
    }
    
    // Default: last 90 days
    const date = new Date();
    date.setDate(date.getDate() - 90);
    return date.toISOString().split('T')[0];
  }

  private async fallbackBasicSearch(text: string): Promise<FactCheckReport> {
    try {
      const query = text.substring(0, 200);
      const results = await this.serpApi.search(query, 5);
      
      const evidence: EvidenceItem[] = results.results.map((r: SerpApiResult, i: number) => {
        const url = new URL(r.link);
        const sourceName = url.hostname.replace(/^www\./, '');
        const reliability = getSourceReliability(sourceName);
        const credScore = reliability ? reliability.reliabilityScore : 60;
        const rating: "High" | "Medium" | "Low" = credScore >= 80 ? "High" : credScore >= 60 ? "Medium" : "Low";
        
        return {
          id: `fallback_${i}`,
          publisher: r.source || sourceName,
          url: r.link,
          quote: r.snippet || '',
          score: credScore,
          credibilityScore: credScore,
          relevanceScore: 70,
          type: 'search_result' as const,
          title: r.title,
          snippet: r.snippet || '',
          publishedDate: r.date || new Date().toISOString(),
          source: {
            name: sourceName,
            url: url.origin,
            credibility: {
              rating: rating,
              classification: 'Web Source',
              warnings: [],
            },
          },
        };
      });

      const avgScore = evidence.length > 0 
        ? Math.round(evidence.reduce((sum, e) => sum + e.score, 0) / evidence.length)
        : 0;

      return completeFactCheckReport({
        id: `fallback_${Date.now()}`,
        originalText: text,
        finalVerdict: this.generateVerdict(avgScore),
        finalScore: avgScore,
        reasoning: `Fallback search found ${evidence.length} sources with average credibility of ${avgScore}%.`,
        evidence,
        enhancedClaimText: text,
      });
    } catch (error) {
      console.error('Fallback search failed:', error);
      return completeFactCheckReport({
        id: `fallback_error_${Date.now()}`,
        originalText: text,
        finalVerdict: 'UNVERIFIED',
        finalScore: 0,
        reasoning: 'Unable to verify claim due to search failures.',
        evidence: [],
        enhancedClaimText: text,
      });
    }
  }

  private async uploadReportToBlob(report: FactCheckReport): Promise<void> {
    try {
      await this.blobStorage.saveReport(report);
      logger.info(`Report ${report.id} saved to blob storage`);
    } catch (error) {
      logger.error('Failed to upload report to blob storage:', error);
      // Don't throw - this is a non-critical operation
    }
  }
}

// Export singleton instance
export const tieredFactCheckService = TieredFactCheckService.getInstance();
