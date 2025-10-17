// src/services/EvidenceEvaluationService.ts
// AI-POWERED EVIDENCE EVALUATION WITH CONTRADICTION DETECTION

import { vertexAiService } from './vertexAiService';
import { Evidence } from '@/types';
import { logger } from '../utils/logger';

// ===== TYPE DEFINITIONS =====

export interface AIAnalysis {
  relevanceScore: number; // 0-100
  credibilityAssessment: string;
  keyQuotes: string[];
  contradictions: string[];
  supportType: 'supporting' | 'contradicting' | 'neutral';
  biasIndicators: string[];
  temporalRelevance: string;
  factualClaims: string[];
}

export interface EvaluatedEvidence extends Evidence {
  aiAnalysis: AIAnalysis;
  enhancedScore: number; // Combined credibility + AI analysis
  relevanceScore: number;
}

export interface ConsensusAnalysis {
  supportingCount: number;
  contradictingCount: number;
  neutralCount: number;
  consensusScore: number; // 0-100
  majorContradictions: string[];
  reliableSourcesCount: number;
}

export interface EvidenceEvaluationResult {
  evaluatedEvidence: EvaluatedEvidence[];
  overallConsensus: ConsensusAnalysis;
  recommendations: string[];
  processingTime: number;
}

// ===== MAIN SERVICE =====

export const evidenceEvaluationService = {
  /**
   * MAIN ENTRY POINT: Evaluate a batch of evidence using AI
   */
  async evaluateEvidenceBatch(
    claim: string,
    evidence: Evidence[],
    atomicClaims?: string[]
  ): Promise<EvidenceEvaluationResult> {
    const startTime = Date.now();

    logger.info('🧠 Starting AI evidence evaluation', {
      evidenceCount: evidence.length,
      atomicClaimsCount: atomicClaims?.length || 0
    });

    if (evidence.length === 0) {
      return this.createEmptyResult();
    }

    try {
      // Evaluate evidence in batches to avoid token limits
      const batchSize = 5;
      const evaluatedBatches: EvaluatedEvidence[] = [];

      for (let i = 0; i < evidence.length; i += batchSize) {
        const batch = evidence.slice(i, i + batchSize);
        const evaluated = await this.evaluateBatch(claim, batch, atomicClaims);
        evaluatedBatches.push(...evaluated);

        logger.info(`Evaluated batch ${Math.floor(i / batchSize) + 1}`, {
          processed: evaluatedBatches.length,
          total: evidence.length
        });
      }

      // Analyze overall consensus
      const consensus = this.analyzeConsensus(evaluatedBatches);
      
      // Generate recommendations
      const recommendations = this.generateRecommendations(evaluatedBatches, consensus);

      logger.info('✅ Evidence evaluation complete', {
        totalEvaluated: evaluatedBatches.length,
        consensusScore: consensus.consensusScore,
        processingTime: Date.now() - startTime
      });

      return {
        evaluatedEvidence: evaluatedBatches,
        overallConsensus: consensus,
        recommendations,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      logger.error('Evidence evaluation failed', { error });
      return this.createFallbackResult(evidence);
    }
  },

  /**
   * Evaluate a batch of evidence items with AI
   */
  async evaluateBatch(
    claim: string,
    evidenceBatch: Evidence[],
    atomicClaims?: string[]
  ): Promise<EvaluatedEvidence[]> {
    const evidenceSummaries = evidenceBatch.map((e, i) => ({
      index: i,
      publisher: e.publisher,
      credibility: e.credibilityScore,
      snippet: (e.snippet || e.quote || '').substring(0, 400),
      url: e.url
    }));

    const prompt = `You are an expert fact-checker evaluating evidence quality and relevance.

CLAIM TO VERIFY: "${claim}"

${atomicClaims && atomicClaims.length > 0 ? `
ATOMIC CLAIMS:
${atomicClaims.map((c, i) => `${i + 1}. ${c}`).join('\n')}
` : ''}

EVIDENCE TO EVALUATE:
${JSON.stringify(evidenceSummaries, null, 2)}

For EACH piece of evidence, analyze:
1. Relevance to the claim (0-100)
2. Support type (supporting/contradicting/neutral)
3. Key quotes that matter
4. Contradictions with other evidence
5. Bias indicators
6. Temporal relevance

Respond with ONLY valid JSON array (one object per evidence item):
[
  {
    "index": 0,
    "relevanceScore": 0-100,
    "credibilityAssessment": "brief assessment",
    "keyQuotes": ["quote 1", "quote 2"],
    "contradictions": ["contradiction description"],
    "supportType": "supporting|contradicting|neutral",
    "biasIndicators": ["bias indicator"],
    "temporalRelevance": "current|outdated|timeless",
    "factualClaims": ["claim extracted from evidence"]
  }
]`;

    try {
      const response = await vertexAiService.generateText(prompt, {
        temperature: 0.2,
        maxOutputTokens: 4096
      });

      const cleaned = response.replace(/```json|```/g, '').trim();
      const analyses: AIAnalysis[] = JSON.parse(cleaned);

      // Combine evidence with AI analysis
      return evidenceBatch.map((evidence, index) => {
        const aiAnalysis = analyses.find(a => a.index === index) || this.createFallbackAnalysis();
        const enhancedScore = this.calculateEnhancedScore(
          evidence.credibilityScore || 50,
          aiAnalysis.relevanceScore,
          aiAnalysis.supportType
        );

        return {
          ...evidence,
          aiAnalysis,
          enhancedScore,
          relevanceScore: aiAnalysis.relevanceScore
        } as EvaluatedEvidence;
      });

    } catch (error) {
      logger.error('Batch evaluation failed', { error });
      return evidenceBatch.map(e => this.createFallbackEvaluatedEvidence(e));
    }
  },

  /**
   * Analyze consensus across all evaluated evidence
   */
  analyzeConsensus(evidence: EvaluatedEvidence[]): ConsensusAnalysis {
    const supporting = evidence.filter(e => e.aiAnalysis.supportType === 'supporting');
    const contradicting = evidence.filter(e => e.aiAnalysis.supportType === 'contradicting');
    const neutral = evidence.filter(e => e.aiAnalysis.supportType === 'neutral');
    const reliable = evidence.filter(e => e.enhancedScore >= 80);

    // Collect major contradictions
    const contradictions = new Set<string>();
    evidence.forEach(e => {
      e.aiAnalysis.contradictions.forEach(c => contradictions.add(c));
    });

    // Calculate consensus score
    const consensusScore = this.calculateConsensusScore(
      supporting.length,
      contradicting.length,
      neutral.length,
      reliable.length
    );

    return {
      supportingCount: supporting.length,
      contradictingCount: contradicting.length,
      neutralCount: neutral.length,
      consensusScore,
      majorContradictions: Array.from(contradictions),
      reliableSourcesCount: reliable.length
    };
  },

  /**
   * Calculate consensus score based on evidence distribution
   */
  calculateConsensusScore(
    supporting: number,
    contradicting: number,
    neutral: number,
    reliable: number
  ): number {
    const total = supporting + contradicting + neutral;
    if (total === 0) return 0;

    // Base score from support ratio
    const supportRatio = supporting / total;
    const contradictRatio = contradicting / total;
    
    let score = 0;

    if (supportRatio > 0.7) {
      // Strong support
      score = 70 + (supportRatio - 0.7) * 100;
    } else if (supportRatio > 0.5) {
      // Moderate support
      score = 50 + (supportRatio - 0.5) * 100;
    } else if (contradictRatio > 0.7) {
      // Strong contradiction
      score = 30 - (contradictRatio - 0.7) * 100;
    } else {
      // Mixed
      score = 50;
    }

    // Adjust for reliable sources
    if (reliable >= 3) {
      score += 10;
    } else if (reliable === 0) {
      score -= 15;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  },

  /**
   * Calculate enhanced score combining credibility and AI analysis
   */
  calculateEnhancedScore(
    baseCredibility: number,
    relevanceScore: number,
    supportType: string
  ): number {
    // Weight: 60% credibility, 40% relevance
    let score = (baseCredibility * 0.6) + (relevanceScore * 0.4);

    // Boost for supporting evidence from high-credibility sources
    if (supportType === 'supporting' && baseCredibility >= 85) {
      score += 5;
    }

    // Penalty for contradicting low-credibility sources
    if (supportType === 'contradicting' && baseCredibility < 70) {
      score -= 10;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  },

  /**
   * Generate recommendations based on evaluation
   */
  generateRecommendations(
    evidence: EvaluatedEvidence[],
    consensus: ConsensusAnalysis
  ): string[] {
    const recommendations: string[] = [];

    // Check for insufficient high-quality sources
    if (consensus.reliableSourcesCount < 3) {
      recommendations.push(
        `⚠️ Only ${consensus.reliableSourcesCount} highly reliable sources found. Consider gathering more evidence.`
      );
    }

    // Check for major contradictions
    if (consensus.majorContradictions.length > 0) {
      recommendations.push(
        `🔍 ${consensus.majorContradictions.length} major contradiction(s) detected. Review conflicting evidence carefully.`
      );
    }

    // Check for low consensus
    if (consensus.consensusScore < 50) {
      recommendations.push(
        '⚠️ Low consensus among sources. This claim may be disputed or require more context.'
      );
    }

    // Check for bias indicators
    const biasCount = evidence.reduce((sum, e) => 
      sum + e.aiAnalysis.biasIndicators.length, 0
    );
    if (biasCount > evidence.length * 0.3) {
      recommendations.push(
        '🔍 Multiple bias indicators detected across sources. Consider source diversity.'
      );
    }

    // Check for outdated evidence
    const outdatedCount = evidence.filter(e => 
      e.aiAnalysis.temporalRelevance === 'outdated'
    ).length;
    if (outdatedCount > evidence.length * 0.4) {
      recommendations.push(
        '📅 Significant portion of evidence may be outdated. Consider more recent sources.'
      );
    }

    // Positive recommendation for strong consensus
    if (consensus.consensusScore >= 85 && consensus.reliableSourcesCount >= 5) {
      recommendations.push(
        '✅ Strong consensus from multiple reliable sources. High confidence in verdict.'
      );
    }

    return recommendations;
  },

  /**
   * Detect contradictions between evidence items
   */
  async detectContradictions(evidence: EvaluatedEvidence[]): Promise<string[]> {
    if (evidence.length < 2) return [];

    const contradictions: string[] = [];

    // Group by support type
    const supporting = evidence.filter(e => e.aiAnalysis.supportType === 'supporting');
    const contradicting = evidence.filter(e => e.aiAnalysis.supportType === 'contradicting');

    if (supporting.length > 0 && contradicting.length > 0) {
      // Find specific contradictions using AI
      const supportingClaims = supporting
        .flatMap(e => e.aiAnalysis.factualClaims)
        .slice(0, 5);
      
      const contradictingClaims = contradicting
        .flatMap(e => e.aiAnalysis.factualClaims)
        .slice(0, 5);

      if (supportingClaims.length > 0 && contradictingClaims.length > 0) {
        try {
          const prompt = `Identify specific contradictions between these two sets of claims:

SUPPORTING CLAIMS:
${supportingClaims.map((c, i) => `${i + 1}. ${c}`).join('\n')}

CONTRADICTING CLAIMS:
${contradictingClaims.map((c, i) => `${i + 1}. ${c}`).join('\n')}

List only the most significant contradictions (max 3). Respond with JSON array:
["contradiction 1", "contradiction 2", "contradiction 3"]`;

          const response = await vertexAiService.generateText(prompt, {
            temperature: 0.1,
            maxOutputTokens: 500
          });

          const parsed = JSON.parse(response.replace(/```json|```/g, '').trim());
          contradictions.push(...parsed);
        } catch (error) {
          logger.warn('Contradiction detection failed', { error });
        }
      }
    }

    return contradictions;
  },

  // ===== FALLBACK METHODS =====

  createEmptyResult(): EvidenceEvaluationResult {
    return {
      evaluatedEvidence: [],
      overallConsensus: {
        supportingCount: 0,
        contradictingCount: 0,
        neutralCount: 0,
        consensusScore: 0,
        majorContradictions: [],
        reliableSourcesCount: 0
      },
      recommendations: ['⚠️ No evidence available for evaluation'],
      processingTime: 0
    };
  },

  createFallbackResult(evidence: Evidence[]): EvidenceEvaluationResult {
    const evaluatedEvidence = evidence.map(e => this.createFallbackEvaluatedEvidence(e));
    const consensus = this.analyzeConsensus(evaluatedEvidence);

    return {
      evaluatedEvidence,
      overallConsensus: consensus,
      recommendations: ['⚠️ AI evaluation unavailable - using fallback statistical analysis'],
      processingTime: 0
    };
  },

  createFallbackEvaluatedEvidence(evidence: Evidence): EvaluatedEvidence {
    return {
      ...evidence,
      aiAnalysis: this.createFallbackAnalysis(),
      enhancedScore: evidence.credibilityScore || 50,
      relevanceScore: 70
    };
  },

  createFallbackAnalysis(): AIAnalysis {
    return {
      relevanceScore: 70,
      credibilityAssessment: 'Fallback evaluation - AI analysis unavailable',
      keyQuotes: [],
      contradictions: [],
      supportType: 'neutral',
      biasIndicators: [],
      temporalRelevance: 'timeless',
      factualClaims: []
    };
  },

  /**
   * Extract key quotes from evidence for citation
   */
  extractKeyQuotes(evidence: EvaluatedEvidence[]): string[] {
    const quotes: string[] = [];

    evidence
      .filter(e => e.enhancedScore >= 75)
      .forEach(e => {
        quotes.push(...e.aiAnalysis.keyQuotes.slice(0, 2));
      });

    return quotes.slice(0, 10); // Limit to top 10 quotes
  },

  /**
   * Get evidence summary for reporting
   */
  getSummary(result: EvidenceEvaluationResult): {
    totalSources: number;
    reliableSources: number;
    supportingPercentage: number;
    contradictingPercentage: number;
    averageRelevance: number;
  } {
    const { evaluatedEvidence, overallConsensus } = result;
    const total = evaluatedEvidence.length;

    if (total === 0) {
      return {
        totalSources: 0,
        reliableSources: 0,
        supportingPercentage: 0,
        contradictingPercentage: 0,
        averageRelevance: 0
      };
    }

    const avgRelevance = evaluatedEvidence.reduce((sum, e) => 
      sum + e.relevanceScore, 0
    ) / total;

    return {
      totalSources: total,
      reliableSources: overallConsensus.reliableSourcesCount,
      supportingPercentage: (overallConsensus.supportingCount / total) * 100,
      contradictingPercentage: (overallConsensus.contradictingCount / total) * 100,
      averageRelevance: Math.round(avgRelevance)
    };
  }
};

// Export types and service
export default evidenceEvaluationService;
