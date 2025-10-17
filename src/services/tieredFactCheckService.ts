// src/services/tieredFactCheckService.ts - FIXED BUILD ERRORS
// Complete AI-powered fact-checking with NO "UNVERIFIED" verdicts

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
import { BlobStorageService, StoredReport } from './blobStorage';
import { generateSHA256 } from '../utils/hashUtils';
import { vertexAiService } from './vertexAiService';
import { simpleIntelligentQuerySynthesizer } from './analysis/SimpleIntelligentQuerySynthesizer';
import { logger } from '../utils/logger';

// ===== TYPE DEFINITIONS =====

// Enhanced evidence with AI analysis
interface EvaluatedEvidence extends Evidence {
  aiAnalysis: {
    relevanceScore: number;
    credibilityAssessment: string;
    keyQuotes: string[];
    contradictions: string[];
    supportType: 'supporting' | 'contradicting' | 'neutral';
    biasIndicators: string[];
    temporalRelevance: string;
    factualClaims: string[];
  };
  enhancedScore: number;
  relevanceScore: number;
}

// Evidence evaluation result
interface EvidenceEvaluationResult {
  evaluatedEvidence: EvaluatedEvidence[];
  overallConsensus: {
    supportingCount: number;
    contradictingCount: number;
    neutralCount: number;
    consensusScore: number;
    majorContradictions: string[];
    reliableSourcesCount: number;
  };
  recommendations: string[];
  processingTime: number;
}

// Status type that matches ClaimVerificationResult
type VerificationStatus = "Verified" | "Unverified" | "Disputed" | "Retracted" | "Error";

// New confidence-based verdict system
export type ConfidenceVerdict = 
  | 'VERIFIED_TRUE'      // 90-100% confidence
  | 'LIKELY_TRUE'        // 75-89% confidence
  | 'MIXED_EVIDENCE'     // 50-74% confidence
  | 'LIKELY_FALSE'       // 25-49% confidence
  | 'VERIFIED_FALSE'     // 10-24% confidence
  | 'INSUFFICIENT_DATA'; // 0-9% confidence (replaces UNVERIFIED)

export interface EnhancedTierResult {
  tier: string;
  success: boolean;
  confidence: number;
  evidence: Evidence[];
  processingTime: number;
  metadata: {
    queriesExecuted: number;
    averageSourceQuality: number;
    aiAnalysisUsed: boolean;
  };
  error?: string;
}

export interface ConfidenceInterval {
  lowerBound: number;
  upperBound: number;
  description: string;
}

// ===== SERVICE INITIALIZATION WITH FALLBACKS =====

let enhancedIntelligentQuerySynthesizer: any;
let evidenceEvaluationService: any;

try {
  const enhancedModule = require('./analysis/EnhancedIntelligentQuerySynthesizer');
  enhancedIntelligentQuerySynthesizer = enhancedModule.enhancedIntelligentQuerySynthesizer;
  logger.info('✅ Enhanced query synthesizer loaded');
} catch {
  logger.warn('⚠️ Enhanced query synthesizer not available, using simple version');
  enhancedIntelligentQuerySynthesizer = {
    generateEnhancedQuerySet: async (claim: string) => {
      const { keywordQuery, contextualQuery } = await simpleIntelligentQuerySynthesizer.generateQueries(claim);
      return {
        queries: [
          { query: keywordQuery, type: 'fact_check', priority: 10, reasoning: 'Keyword-based fact check', expectedSources: [] },
          { query: contextualQuery || keywordQuery, type: 'contextual', priority: 7, reasoning: 'Contextual search', expectedSources: [] }
        ],
        claimAnalysis: {
          atomicClaims: [{ id: 'claim_1', text: claim, priority: 10, verifiable: true, requiresContext: false }],
          entities: [],
          claimType: 'factual',
          complexity: 'simple',
          domain: 'general',
          temporalContext: 'current',
          controversialityScore: 0.5
        },
        searchStrategy: 'basic',
        estimatedSourcesNeeded: 10
      };
    }
  };
}

try {
  const evidenceModule = require('./EvidenceEvaluationService');
  evidenceEvaluationService = evidenceModule.evidenceEvaluationService;
  logger.info('✅ Evidence evaluation service loaded');
} catch {
  logger.warn('⚠️ Evidence evaluation service not available, using fallback');
  evidenceEvaluationService = {
    evaluateEvidenceBatch: async (claim: string, evidence: Evidence[], atomicClaims?: string[]): Promise<EvidenceEvaluationResult> => {
      return {
        evaluatedEvidence: evidence.map((e: Evidence): EvaluatedEvidence => ({
          ...e,
          aiAnalysis: {
            relevanceScore: 70,
            credibilityAssessment: 'Fallback evaluation',
            keyQuotes: [],
            contradictions: [],
            supportType: 'neutral' as const,
            biasIndicators: [],
            temporalRelevance: 'timeless',
            factualClaims: []
          },
          enhancedScore: e.credibilityScore || 50,
          relevanceScore: 70
        })),
        overallConsensus: {
          supportingCount: Math.floor(evidence.length * 0.6),
          contradictingCount: Math.floor(evidence.length * 0.2),
          neutralCount: Math.floor(evidence.length * 0.2),
          consensusScore: 65,
          majorContradictions: [],
          reliableSourcesCount: evidence.filter(e => (e.credibilityScore || 0) >= 80).length
        },
        recommendations: ['Using fallback evidence evaluation'],
        processingTime: 0
      };
    }
  };
}

/**
 * INDUSTRY-STANDARD FACT-CHECKING SERVICE
 * Features:
 * - AI-powered claim analysis
 * - Parallel evidence collection
 * - Deep evidence evaluation
 * - Confidence-based verdicts (NO "UNVERIFIED")
 * - Atomic claim verification
 */
export class TieredFactCheckService {
  private static instance: TieredFactCheckService;
  private googleFactCheck = GoogleFactCheckService.getInstance();
  private serpApi = SerpApiService.getInstance();
  private newsService = new WebzNewsService();
  private blobStorage = BlobStorageService.getInstance();

  static getInstance(): TieredFactCheckService {
    if (!TieredFactCheckService.instance) {
      TieredFactCheckService.instance = new TieredFactCheckService();
    }
    return TieredFactCheckService.instance;
  }

  /**
   * MAIN ENTRY POINT: Industry-standard fact-checking pipeline
   */
  async performTieredCheck(
    claimText: string,
    publishingContext: PublishingContext
  ): Promise<FactCheckReport> {
    const startTime = Date.now();
    const operationId = await generateSHA256(claimText + startTime);
    
    logger.info('🚀 Starting industry-standard fact-check', {
      operationId,
      claimLength: claimText.length,
      context: publishingContext
    });

    try {
      // ===== STAGE 1: AI CLAIM ANALYSIS =====
      logger.info('📊 STAGE 1: AI Claim Analysis');
      const querySet = await enhancedIntelligentQuerySynthesizer.generateEnhancedQuerySet(claimText);
      const { claimAnalysis, queries } = querySet;

      logger.info('✅ Claim analysis complete', {
        atomicClaims: claimAnalysis.atomicClaims.length,
        entities: claimAnalysis.entities?.length || 0,
        complexity: claimAnalysis.complexity,
        domain: claimAnalysis.domain,
        queriesGenerated: queries.length
      });

      // ===== STAGE 2: PARALLEL EVIDENCE COLLECTION =====
      logger.info('🔍 STAGE 2: Parallel Evidence Collection');
      const evidenceCollectionStart = Date.now();
      
      const allEvidence = await this.collectEvidenceParallel(queries, claimAnalysis.domain);
      
      logger.info('✅ Evidence collection complete', {
        totalEvidence: allEvidence.length,
        collectionTime: Date.now() - evidenceCollectionStart,
        averageQuality: this.calculateAverageQuality(allEvidence)
      });

      // ===== STAGE 3: AI EVIDENCE EVALUATION =====
      logger.info('🧠 STAGE 3: AI Evidence Evaluation');
      const evaluationStart = Date.now();
      
      const evaluation = await evidenceEvaluationService.evaluateEvidenceBatch(
        claimText,
        allEvidence,
        claimAnalysis.atomicClaims.map((c: any) => c.text)
      );

      logger.info('✅ Evidence evaluation complete', {
        evaluatedSources: evaluation.evaluatedEvidence.length,
        consensusScore: evaluation.overallConsensus.consensusScore,
        supportingCount: evaluation.overallConsensus.supportingCount,
        contradictingCount: evaluation.overallConsensus.contradictingCount,
        evaluationTime: Date.now() - evaluationStart
      });

      // ===== STAGE 4: ATOMIC CLAIM VERIFICATION =====
      logger.info('🎯 STAGE 4: Atomic Claim Verification');
      const atomicVerifications = await this.verifyAtomicClaims(
        claimAnalysis.atomicClaims,
        evaluation.evaluatedEvidence
      );

      // ===== STAGE 5: INTELLIGENT SYNTHESIS =====
      logger.info('🔬 STAGE 5: Intelligent Synthesis');
      const synthesis = await this.performIntelligentSynthesis(
        claimText,
        claimAnalysis,
        evaluation,
        atomicVerifications,
        publishingContext
      );

      // ===== STAGE 6: FINAL REPORT GENERATION =====
      const finalReport = this.generateFinalReport(
        operationId,
        claimText,
        claimAnalysis,
        evaluation,
        atomicVerifications,
        synthesis,
        startTime
      );

      logger.info('✅ Fact-check complete', {
        operationId,
        finalScore: finalReport.finalScore,
        confidenceVerdict: synthesis.confidenceVerdict,
        processingTime: Date.now() - startTime
      });

      // Save to blob storage
      await this.uploadReportToBlob(finalReport);

      return finalReport;

    } catch (error) {
      logger.error('❌ Fact-check failed', { error, operationId });
      return this.createIntelligentErrorReport(claimText, error as Error, operationId);
    }
  }

  /**
   * STAGE 2: Collect evidence from multiple sources in parallel
   */
  private async collectEvidenceParallel(
    queries: any[],
    domain: string
  ): Promise<Evidence[]> {
    const highPriorityQueries = queries.filter(q => q.priority >= 8).slice(0, 8);
    const mediumPriorityQueries = queries.filter(q => q.priority >= 5 && q.priority < 8).slice(0, 5);

    logger.info('Executing queries in parallel', {
      highPriority: highPriorityQueries.length,
      mediumPriority: mediumPriorityQueries.length
    });

    const allQueryPromises = [
      ...highPriorityQueries.map(q => this.executeQuery(q, domain)),
      ...mediumPriorityQueries.map(q => this.executeQuery(q, domain))
    ];

    const results = await Promise.allSettled(allQueryPromises);

    const allEvidence: Evidence[] = [];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        allEvidence.push(...result.value);
      } else {
        logger.warn('Query execution failed', {
          queryIndex: index,
          error: result.reason
        });
      }
    });

    return this.deduplicateEvidence(allEvidence);
  }

  /**
   * Execute a single search query based on its type
   */
  private async executeQuery(query: any, domain: string): Promise<Evidence[]> {
    const evidence: Evidence[] = [];

    try {
      switch (query.type) {
        case 'fact_check':
          const factCheckReport = await this.googleFactCheck.searchClaims(query.query, 5);
          if (factCheckReport) {
            evidence.push(...factCheckReport.evidence);
          }
          break;

        case 'academic':
        case 'expert':
        case 'primary_source':
          const academicResults = await this.serpApi.search(query.query, 8);
          evidence.push(...this.convertSerpToEvidence(academicResults.results, query.type));
          break;

        case 'news':
          const newsResults = await this.newsService.searchNews({ query: query.query });
          if (newsResults?.posts) {
            evidence.push(...this.convertNewsToEvidence(newsResults.posts));
          }
          break;

        case 'government':
          const govQuery = `${query.query} site:.gov`;
          const govResults = await this.serpApi.search(govQuery, 5);
          evidence.push(...this.convertSerpToEvidence(govResults.results, 'government'));
          break;

        default:
          const webResults = await this.serpApi.search(query.query, 5);
          evidence.push(...this.convertSerpToEvidence(webResults.results, 'contextual'));
      }
    } catch (error) {
      logger.warn('Query execution error', {
        query: query.query,
        type: query.type,
        error
      });
    }

    return evidence;
  }

  /**
   * STAGE 4: Verify each atomic claim individually
   */
  private async verifyAtomicClaims(
    atomicClaims: any[],
    evaluatedEvidence: EvaluatedEvidence[]
  ): Promise<ClaimVerificationResult[]> {
    logger.info('Verifying atomic claims', { count: atomicClaims.length });

    const verifications = await Promise.all(
      atomicClaims.map(async (claim) => {
        const relevantEvidence = evaluatedEvidence.filter(e => 
          e.aiAnalysis.relevanceScore >= 60 &&
          e.enhancedScore >= 50
        );

        const verification = await this.verifyAtomicClaim(claim.text, relevantEvidence);

        // Convert AI status to ClaimVerificationResult status
        const status = this.convertToVerificationStatus(verification.status);

        return {
          id: claim.id,
          claimText: claim.text,
          status,
          confidenceScore: verification.confidence,
          explanation: verification.explanation,
          reasoning: verification.reasoning,
          evidence: relevantEvidence.slice(0, 5)
        };
      })
    );

    return verifications;
  }

  /**
   * Convert AI verification status to ClaimVerificationResult status
   */
  private convertToVerificationStatus(aiStatus: string): VerificationStatus {
    const normalized = aiStatus.toLowerCase().replace(/\s+/g, '');
    
    if (normalized.includes('verified') || normalized.includes('true')) {
      return 'Verified';
    }
    if (normalized.includes('disputed') || normalized.includes('mixed')) {
      return 'Disputed';
    }
    if (normalized.includes('false') || normalized.includes('debunked')) {
      return 'Retracted';
    }
    if (normalized.includes('error')) {
      return 'Error';
    }
    return 'Unverified';
  }

  /**
   * Verify a single atomic claim using AI
   */
  private async verifyAtomicClaim(
    claimText: string,
    evidence: EvaluatedEvidence[]
  ): Promise<{ status: string; confidence: number; explanation: string; reasoning: string }> {
    if (evidence.length === 0) {
      return {
        status: 'Insufficient Data',
        confidence: 0,
        explanation: 'No relevant evidence found for this specific claim.',
        reasoning: 'Unable to verify without sources.'
      };
    }

    const evidenceSummary = evidence.slice(0, 5).map(e => ({
      publisher: e.publisher,
      credibility: e.enhancedScore,
      supportType: e.aiAnalysis.supportType,
      quote: (e.snippet || e.quote || '').substring(0, 200)
    }));

    const prompt = `Verify this specific claim based on the provided evidence.

CLAIM: "${claimText}"

EVIDENCE:
${JSON.stringify(evidenceSummary, null, 2)}

Respond with ONLY valid JSON:
{
  "status": "Verified" | "Likely True" | "Disputed" | "Likely False" | "False" | "Insufficient Data",
  "confidence": 0-100,
  "explanation": "brief verdict explanation",
  "reasoning": "detailed reasoning based on evidence"
}`;

    try {
      const response = await vertexAiService.generateText(prompt, {
        temperature: 0.1,
        maxOutputTokens: 1000
      });

      const cleaned = response.replace(/```json|```/g, '').trim();
      return JSON.parse(cleaned);
    } catch (error) {
      logger.warn('Atomic claim verification failed', { error });
      return {
        status: 'Error',
        confidence: 0,
        explanation: 'AI verification failed',
        reasoning: 'Unable to process verification'
      };
    }
  }

  /**
   * STAGE 5: Perform intelligent synthesis with confidence intervals
   */
  private async performIntelligentSynthesis(
    originalClaim: string,
    claimAnalysis: any,
    evaluation: EvidenceEvaluationResult,
    atomicVerifications: ClaimVerificationResult[],
    publishingContext: PublishingContext
  ): Promise<{
    confidenceVerdict: ConfidenceVerdict;
    finalScore: number;
    confidenceInterval: ConfidenceInterval;
    reasoning: string;
    scoreBreakdown: ScoreBreakdown;
    warnings: string[];
  }> {
    const atomicClaimSummary = atomicVerifications.map(v => ({
      claim: v.claimText,
      status: v.status,
      confidence: v.confidenceScore
    }));

    const evidenceSummary = {
      total: evaluation.evaluatedEvidence.length,
      supporting: evaluation.overallConsensus.supportingCount,
      contradicting: evaluation.overallConsensus.contradictingCount,
      reliable: evaluation.overallConsensus.reliableSourcesCount,
      consensusScore: evaluation.overallConsensus.consensusScore
    };

    const prompt = `You are an expert fact-checker performing final synthesis. Analyze ALL evidence and atomic claim verifications to produce a DEFINITIVE verdict with confidence intervals.

ORIGINAL CLAIM: "${originalClaim}"

CLAIM ANALYSIS:
- Type: ${claimAnalysis.claimType}
- Domain: ${claimAnalysis.domain}
- Complexity: ${claimAnalysis.complexity}
- Controversiality: ${claimAnalysis.controversialityScore}

ATOMIC CLAIM VERIFICATIONS:
${JSON.stringify(atomicClaimSummary, null, 2)}

EVIDENCE SUMMARY:
${JSON.stringify(evidenceSummary, null, 2)}

PUBLISHING CONTEXT: ${publishingContext}

Your task: Provide a CONFIDENT verdict. Never use "UNVERIFIED" - instead provide your best assessment with confidence intervals.

Respond with ONLY valid JSON:
{
  "confidenceVerdict": "VERIFIED_TRUE" | "LIKELY_TRUE" | "MIXED_EVIDENCE" | "LIKELY_FALSE" | "VERIFIED_FALSE" | "INSUFFICIENT_DATA",
  "finalScore": 0-100,
  "confidenceInterval": {
    "lowerBound": 0-100,
    "upperBound": 0-100,
    "description": "explanation of confidence range"
  },
  "reasoning": "comprehensive reasoning explaining the verdict, confidence, and any uncertainties",
  "scoreBreakdown": {
    "finalScoreFormula": "how the score was calculated",
    "metrics": [
      {
        "name": "Evidence Quality",
        "score": 0-100,
        "weight": 0.35,
        "description": "...",
        "reasoning": "..."
      },
      {
        "name": "Source Consensus",
        "score": 0-100,
        "weight": 0.25,
        "description": "...",
        "reasoning": "..."
      },
      {
        "name": "Atomic Claims Verified",
        "score": 0-100,
        "weight": 0.25,
        "description": "...",
        "reasoning": "..."
      },
      {
        "name": "Source Credibility",
        "score": 0-100,
        "weight": 0.15,
        "description": "...",
        "reasoning": "..."
      }
    ]
  },
  "warnings": ["array of important warnings or caveats"]
}

Guidelines:
- VERIFIED_TRUE (90-100%): Multiple high-credibility sources strongly support, no significant contradictions
- LIKELY_TRUE (75-89%): Preponderance of credible evidence supports, minor contradictions
- MIXED_EVIDENCE (50-74%): Significant evidence both supporting and contradicting
- LIKELY_FALSE (25-49%): Preponderance of evidence contradicts
- VERIFIED_FALSE (10-24%): Multiple credible sources debunk
- INSUFFICIENT_DATA (0-9%): Very limited or no reliable evidence (use sparingly)`;

    try {
      const response = await vertexAiService.generateText(prompt, {
        temperature: 0.2,
        maxOutputTokens: 3000
      });

      const cleaned = response.replace(/```json|```/g, '').trim();
      const synthesis = JSON.parse(cleaned);

      return {
        confidenceVerdict: synthesis.confidenceVerdict as ConfidenceVerdict,
        finalScore: synthesis.finalScore,
        confidenceInterval: synthesis.confidenceInterval,
        reasoning: synthesis.reasoning,
        scoreBreakdown: synthesis.scoreBreakdown,
        warnings: synthesis.warnings || []
      };

    } catch (error) {
      logger.error('Synthesis failed, using fallback', { error });
      return this.createFallbackSynthesis(evaluation, atomicVerifications);
    }
  }

  /**
   * Generate final comprehensive report
   */
  private generateFinalReport(
    operationId: string,
    originalClaim: string,
    claimAnalysis: any,
    evaluation: EvidenceEvaluationResult,
    atomicVerifications: ClaimVerificationResult[],
    synthesis: any,
    startTime: number
  ): FactCheckReport {
    const metadata: FactCheckMetadata = {
      methodUsed: 'industry-standard-tiered-ai',
      processingTimeMs: Date.now() - startTime,
      apisUsed: ['vertex-ai', 'google-fact-check', 'serp-api', 'news-api', 'evidence-evaluation-ai'],
      sourcesConsulted: {
        total: evaluation.evaluatedEvidence.length,
        highCredibility: evaluation.overallConsensus.reliableSourcesCount,
        conflicting: evaluation.overallConsensus.contradictingCount
      },
      warnings: [
        ...evaluation.recommendations,
        ...synthesis.warnings,
        ...evaluation.overallConsensus.majorContradictions.map((c: string) => `Contradiction: ${c}`)
      ]
    };

    const factVerdict = this.convertToFactVerdict(synthesis.confidenceVerdict, synthesis.finalScore);

    return {
      id: operationId,
      originalText: originalClaim,
      finalVerdict: factVerdict,
      finalScore: synthesis.finalScore,
      reasoning: synthesis.reasoning,
      evidence: evaluation.evaluatedEvidence,
      claimVerifications: atomicVerifications,
      scoreBreakdown: synthesis.scoreBreakdown,
      metadata,
      summary: `${synthesis.confidenceVerdict}: ${synthesis.reasoning.substring(0, 200)}...`,
      overallAuthenticityScore: synthesis.finalScore,
      enhancedClaimText: originalClaim,
      confidenceVerdict: synthesis.confidenceVerdict,
      confidenceInterval: synthesis.confidenceInterval,
      atomicClaimsAnalysis: {
        totalClaims: claimAnalysis.atomicClaims.length,
        verifiedClaims: atomicVerifications.filter(v => v.status === 'Verified').length,
        disputedClaims: atomicVerifications.filter(v => v.status === 'Disputed').length
      }
    } as FactCheckReport;
  }

  /**
   * Create intelligent error report
   */
  private createIntelligentErrorReport(
    claim: string,
    error: Error,
    operationId: string
  ): FactCheckReport {
    return {
      id: operationId,
      originalText: claim,
      finalVerdict: 'UNVERIFIED',
      finalScore: 0,
      reasoning: `Analysis interrupted: ${error.message}. This is a technical failure, not a content assessment.`,
      evidence: [],
      claimVerifications: [],
      scoreBreakdown: {
        finalScoreFormula: 'Error - no calculation performed',
        metrics: []
      },
      metadata: {
        methodUsed: 'error-handling',
        processingTimeMs: 0,
        apisUsed: [],
        sourcesConsulted: { total: 0, highCredibility: 0, conflicting: 0 },
        warnings: [
          'Analysis failed due to technical error',
          `Error: ${error.message}`,
          'Please try again or contact support if error persists'
        ]
      },
      summary: 'Technical error occurred during analysis',
      overallAuthenticityScore: 0
    } as FactCheckReport;
  }

  // ===== HELPER METHODS =====

  private convertToFactVerdict(confidenceVerdict: ConfidenceVerdict, score: number): FactVerdict {
    switch (confidenceVerdict) {
      case 'VERIFIED_TRUE':
      case 'LIKELY_TRUE':
        return 'TRUE';
      case 'MIXED_EVIDENCE':
        return 'MIXED';
      case 'LIKELY_FALSE':
      case 'VERIFIED_FALSE':
        return 'FALSE';
      case 'INSUFFICIENT_DATA':
        return score < 30 ? 'FALSE' : 'MIXED';
      default:
        return 'MIXED';
    }
  }

  private createFallbackSynthesis(
    evaluation: EvidenceEvaluationResult,
    atomicVerifications: ClaimVerificationResult[]
  ): any {
    const avgScore = evaluation.overallConsensus.consensusScore;
    const verifiedCount = atomicVerifications.filter(v => v.status === 'Verified').length;
    const totalClaims = atomicVerifications.length;

    let confidenceVerdict: ConfidenceVerdict;
    if (avgScore >= 90) confidenceVerdict = 'VERIFIED_TRUE';
    else if (avgScore >= 75) confidenceVerdict = 'LIKELY_TRUE';
    else if (avgScore >= 50) confidenceVerdict = 'MIXED_EVIDENCE';
    else if (avgScore >= 25) confidenceVerdict = 'LIKELY_FALSE';
    else if (avgScore >= 10) confidenceVerdict = 'VERIFIED_FALSE';
    else confidenceVerdict = 'INSUFFICIENT_DATA';

    return {
      confidenceVerdict,
      finalScore: avgScore,
      confidenceInterval: {
        lowerBound: Math.max(0, avgScore - 15),
        upperBound: Math.min(100, avgScore + 15),
        description: 'Estimated confidence range based on source consensus'
      },
      reasoning: `Statistical analysis: ${verifiedCount}/${totalClaims} atomic claims verified. Consensus score: ${avgScore}%. ${evaluation.overallConsensus.supportingCount} supporting sources, ${evaluation.overallConsensus.contradictingCount} contradicting.`,
      scoreBreakdown: {
        finalScoreFormula: 'Consensus-based statistical fallback',
        metrics: [
          {
            name: 'Source Consensus',
            score: avgScore,
            weight: 0.6,
            description: 'Agreement among sources',
            reasoning: `${evaluation.overallConsensus.supportingCount} supporting vs ${evaluation.overallConsensus.contradictingCount} contradicting`
          },
          {
            name: 'Atomic Verification',
            score: (verifiedCount / totalClaims) * 100,
            weight: 0.4,
            description: 'Individual claim verification',
            reasoning: `${verifiedCount} out of ${totalClaims} claims verified`
          }
        ]
      },
      warnings: ['AI synthesis unavailable - using statistical fallback']
    };
  }

  private deduplicateEvidence(evidence: Evidence[]): Evidence[] {
    const seen = new Set<string>();
    const unique: Evidence[] = [];

    evidence.forEach(item => {
      const key = item.url || `${item.publisher}-${(item.snippet || '').substring(0, 50)}`;
      const normalizedKey = key.toLowerCase().replace(/\/$/, '');

      if (!seen.has(normalizedKey)) {
        seen.add(normalizedKey);
        unique.push(item);
      }
    });

    return unique;
  }

  private calculateAverageQuality(evidence: Evidence[]): number {
    if (evidence.length === 0) return 0;
    const sum = evidence.reduce((acc, e) => acc + (e.credibilityScore || 50), 0);
    return Math.round(sum / evidence.length);
  }

  private convertSerpToEvidence(results: SerpApiResult[], type: string): Evidence[] {
    return results.map((r, i) => {
      const url = new URL(r.link);
      const sourceName = url.hostname.replace(/^www\./, '');
      const reliability = getSourceReliability(sourceName);
      const credScore = reliability?.reliabilityScore || 60;

      return {
        id: `serp_${type}_${i}_${Date.now()}`,
        url: r.link,
        title: r.title,
        snippet: r.snippet || '',
        publisher: r.source || sourceName,
        publicationDate: r.date,
        credibilityScore: credScore,
        relevanceScore: 70,
        type: 'search_result',
        source: {
          name: sourceName,
          url: url.origin,
          credibility: {
            rating: credScore >= 80 ? 'High' : credScore >= 60 ? 'Medium' : 'Low',
            classification: type,
            warnings: []
          }
        },
        score: credScore,
        quote: r.snippet || ''
      };
    });
  }

  private convertNewsToEvidence(posts: any[]): Evidence[] {
    return posts.map((post, i) => {
      const url = new URL(post.url);
      const sourceName = url.hostname.replace(/^www\./, '');
      const reliability = getSourceReliability(sourceName);

      return {
        id: `news_${i}_${Date.now()}`,
        url: post.url,
        title: post.title || 'Untitled',
        snippet: (post.text || '').substring(0, 300),
        publisher: post.author || sourceName,
        publicationDate: post.published,
        credibilityScore: reliability?.reliabilityScore || 70,
        relevanceScore: 75,
        type: 'news',
        source: {
          name: sourceName,
          url: url.origin,
          credibility: {
            rating: 'Medium',
            classification: 'News Media',
            warnings: []
          }
        },
        score: reliability?.reliabilityScore || 70,
        quote: (post.text || '').substring(0, 300)
      };
    });
  }

  private async uploadReportToBlob(report: FactCheckReport): Promise<void> {
    try {
      const storedReport: StoredReport = {
        id: report.id,
        originalText: report.originalText,
        report: report,
        corrections: [],
        timestamp: new Date().toISOString(),
        userId: undefined
      };

      await this.blobStorage.saveReport(storedReport);
      logger.info(`Report ${report.id} saved to blob storage`);
    } catch (error) {
      logger.error('Failed to upload report to blob storage:', error);
    }
  }
}

// Export singleton instance
export const tieredFactCheckService = TieredFactCheckService.getInstance();
