// src/services/EvidenceEvaluationService.ts
// Comprehensive evidence evaluation with AI-powered analysis

import { vertexAiService } from './vertexAiService';
import { logger } from '../utils/logger';
import { parseAIJsonResponse } from '../utils/jsonParser';

// ===== TYPE DEFINITIONS =====

export interface Evidence {
  id: string;
  url: string;
  title: string;
  snippet: string;
  publisher: string;
  publicationDate?: string;
  credibilityScore: number;
  relevanceScore: number;
  type: 'claim' | 'news' | 'search_result';
  source: {
    name: string;
    url: string;
  };
}

export interface AIAnalysis {
  overallVerdict: 'SUPPORTS' | 'CONTRADICTS' | 'NEUTRAL' | 'INSUFFICIENT';
  confidence: number;
  reasoning: string;
  contradictions: string[];
  corroboration: string[];
  gaps: string[];
}

export interface EvidenceScore {
  evidenceId: string;
  credibilityScore: number;
  relevanceScore: number;
  freshnessScore: number;
  consistencyScore: number;
  finalScore: number;
  reasoning: string;
}

export interface EvaluationResult {
  scores: EvidenceScore[];
  aiAnalysis: AIAnalysis;
  aggregateMetrics: {
    averageCredibility: number;
    averageRelevance: number;
    averageFreshness: number;
    totalEvidence: number;
    highQualityCount: number;
    contradictionCount: number;
    corroborationCount: number;
  };
  recommendations: string[];
  processingTimeMs: number;
}

// ===== MAIN SERVICE CLASS =====

export class EvidenceEvaluationService {
  private static instance: EvidenceEvaluationService;

  private constructor() {}

  static getInstance(): EvidenceEvaluationService {
    if (!EvidenceEvaluationService.instance) {
      EvidenceEvaluationService.instance = new EvidenceEvaluationService();
    }
    return EvidenceEvaluationService.instance;
  }

  /**
   * Evaluate all evidence and generate comprehensive scoring
   */
  async evaluateEvidence(
    evidence: Evidence[],
    originalClaim: string
  ): Promise<EvaluationResult> {
    const startTime = Date.now();
    logger.info('🔍 Starting Evidence Evaluation', {
      evidenceCount: evidence.length,
      claimLength: originalClaim.length
    });

    try {
      // Step 1: Score each piece of evidence
      const scores = evidence.map(e => this.scoreEvidence(e, originalClaim));

      // Step 2: Get AI analysis of evidence consistency
      const aiAnalysis = await this.performAIAnalysis(evidence, originalClaim);

      // Step 3: Calculate aggregate metrics
      const aggregateMetrics = this.calculateAggregateMetrics(scores, aiAnalysis);

      // Step 4: Generate recommendations
      const recommendations = this.generateRecommendations(scores, aiAnalysis, aggregateMetrics);

      const processingTime = Date.now() - startTime;

      logger.info('✅ Evidence Evaluation Complete', {
        processingTimeMs: processingTime,
        averageScore: aggregateMetrics.averageCredibility,
        verdict: aiAnalysis.overallVerdict
      });

      return {
        scores,
        aiAnalysis,
        aggregateMetrics,
        recommendations,
        processingTimeMs: processingTime
      };

    } catch (error: any) {
      logger.error('Evidence evaluation failed', error);
      // Return fallback result instead of throwing
      return this.createFallbackResult(evidence, originalClaim, Date.now() - startTime);
    }
  }

  // ===== SCORING METHODS =====

  /**
   * Score individual evidence piece
   */
  private scoreEvidence(evidence: Evidence, claim: string): EvidenceScore {
    const credibilityScore = evidence.credibilityScore;
    const relevanceScore = this.calculateRelevanceScore(evidence, claim);
    const freshnessScore = this.calculateFreshnessScore(evidence.publicationDate);
    const consistencyScore = evidence.relevanceScore; // Use existing relevance as consistency

    // Weighted final score
    const finalScore = Math.round(
      credibilityScore * 0.4 +
      relevanceScore * 0.3 +
      freshnessScore * 0.15 +
      consistencyScore * 0.15
    );

    return {
      evidenceId: evidence.id,
      credibilityScore,
      relevanceScore,
      freshnessScore,
      consistencyScore,
      finalScore,
      reasoning: this.generateScoreReasoning(evidence, finalScore)
    };
  }

  /**
   * Calculate relevance score based on content similarity
   */
  private calculateRelevanceScore(evidence: Evidence, claim: string): number {
    const claimLower = claim.toLowerCase();
    const snippetLower = (evidence.snippet || '').toLowerCase();
    const titleLower = (evidence.title || '').toLowerCase();

    // Extract key terms from claim
    const claimTerms = claimLower
      .split(/\s+/)
      .filter(term => term.length > 3)
      .slice(0, 10);

    // Count matching terms
    let matches = 0;
    claimTerms.forEach(term => {
      if (snippetLower.includes(term) || titleLower.includes(term)) {
        matches++;
      }
    });

    // Calculate percentage match
    const matchPercentage = claimTerms.length > 0 
      ? (matches / claimTerms.length) * 100 
      : 50;

    return Math.min(100, Math.round(matchPercentage));
  }

  /**
   * Calculate freshness score based on publication date
   */
  private calculateFreshnessScore(publicationDate?: string): number {
    if (!publicationDate) return 50; // Default moderate freshness

    try {
      const published = new Date(publicationDate);
      const now = new Date();
      const daysDiff = Math.floor((now.getTime() - published.getTime()) / (1000 * 60 * 60 * 24));

      // Freshness scoring
      if (daysDiff <= 7) return 100;
      if (daysDiff <= 30) return 90;
      if (daysDiff <= 90) return 80;
      if (daysDiff <= 180) return 70;
      if (daysDiff <= 365) return 60;
      if (daysDiff <= 730) return 50;
      return 40;
    } catch {
      return 50;
    }
  }

  /**
   * Generate reasoning text for score
   */
  private generateScoreReasoning(evidence: Evidence, finalScore: number): string {
    const reasons: string[] = [];

    if (evidence.credibilityScore >= 90) {
      reasons.push('highly credible source');
    } else if (evidence.credibilityScore >= 70) {
      reasons.push('credible source');
    } else {
      reasons.push('moderate credibility');
    }

    if (evidence.type === 'claim') {
      reasons.push('fact-check claim');
    } else if (evidence.type === 'news') {
      reasons.push('news article');
    }

    if (finalScore >= 85) {
      return `Strong evidence: ${reasons.join(', ')}`;
    } else if (finalScore >= 70) {
      return `Good evidence: ${reasons.join(', ')}`;
    } else if (finalScore >= 50) {
      return `Moderate evidence: ${reasons.join(', ')}`;
    } else {
      return `Weak evidence: ${reasons.join(', ')}`;
    }
  }

  // ===== AI ANALYSIS =====

  /**
   * Use Vertex AI to analyze evidence consistency
   */
  private async performAIAnalysis(
    evidence: Evidence[],
    claim: string
  ): Promise<AIAnalysis> {
    // Limit evidence to top 10 for AI analysis
    const topEvidence = evidence
      .sort((a, b) => b.credibilityScore - a.credibilityScore)
      .slice(0, 10);

    const prompt = this.buildAIAnalysisPrompt(topEvidence, claim);

    try {
      const response = await vertexAiService.generateText(prompt, {
        temperature: 0.3,
        maxOutputTokens: 1024
      });

      const parsed = parseAIJsonResponse(response);

      logger.info('✅ Vertex AI analysis complete', {
        verdict: parsed.overallVerdict,
        confidence: parsed.confidence
      });

      return {
        overallVerdict: parsed.overallVerdict || 'INSUFFICIENT',
        confidence: parsed.confidence || 50,
        reasoning: parsed.reasoning || 'Analysis could not be completed',
        contradictions: parsed.contradictions || [],
        corroboration: parsed.corroboration || [],
        gaps: parsed.gaps || []
      };

    } catch (error) {
      logger.warn('AI analysis failed, using heuristic', error);
      return this.performHeuristicAnalysis(evidence, claim);
    }
  }

  /**
   * Build prompt for AI analysis
   */
  private buildAIAnalysisPrompt(evidence: Evidence[], claim: string): string {
    const evidenceSummary = evidence
      .map((e, idx) => {
        return `[${idx + 1}] ${e.publisher} (${e.credibilityScore}% credibility):\n"${e.snippet.substring(0, 200)}..."`;
      })
      .join('\n\n');

    return `You are a professional fact-checker analyzing evidence for this claim:

CLAIM: "${claim}"

EVIDENCE:
${evidenceSummary}

Analyze the evidence and provide:
1. Overall verdict (SUPPORTS, CONTRADICTS, NEUTRAL, or INSUFFICIENT)
2. Confidence level (0-100)
3. Reasoning (2-3 sentences)
4. Any contradictions found
5. Points of corroboration
6. Information gaps

Return ONLY valid JSON in this exact format (no markdown, no code blocks):
{
  "overallVerdict": "SUPPORTS|CONTRADICTS|NEUTRAL|INSUFFICIENT",
  "confidence": 85,
  "reasoning": "brief explanation",
  "contradictions": ["contradiction 1", "contradiction 2"],
  "corroboration": ["point 1", "point 2"],
  "gaps": ["missing info 1", "missing info 2"]
}`;
  }

  /**
   * Fallback heuristic analysis if AI fails
   */
  private performHeuristicAnalysis(evidence: Evidence[], claim: string): AIAnalysis {
    const highQuality = evidence.filter(e => e.credibilityScore >= 80);
    const supportingKeywords = ['confirmed', 'verified', 'true', 'accurate'];
    const contradictingKeywords = ['false', 'debunked', 'fake', 'misleading'];

    let supportCount = 0;
    let contradictCount = 0;

    evidence.forEach(e => {
      const snippetLower = e.snippet.toLowerCase();
      if (supportingKeywords.some(kw => snippetLower.includes(kw))) {
        supportCount++;
      }
      if (contradictingKeywords.some(kw => snippetLower.includes(kw))) {
        contradictCount++;
      }
    });

    let verdict: AIAnalysis['overallVerdict'] = 'INSUFFICIENT';
    let confidence = 50;

    if (highQuality.length >= 3) {
      if (supportCount > contradictCount) {
        verdict = 'SUPPORTS';
        confidence = 70 + Math.min(20, highQuality.length * 5);
      } else if (contradictCount > supportCount) {
        verdict = 'CONTRADICTS';
        confidence = 70 + Math.min(20, highQuality.length * 5);
      } else {
        verdict = 'NEUTRAL';
        confidence = 60;
      }
    }

    return {
      overallVerdict: verdict,
      confidence,
      reasoning: `Heuristic analysis based on ${evidence.length} sources (${highQuality.length} high-quality)`,
      contradictions: contradictCount > 0 ? [`Found ${contradictCount} potential contradictions`] : [],
      corroboration: supportCount > 0 ? [`Found ${supportCount} supporting sources`] : [],
      gaps: evidence.length < 5 ? ['Limited evidence available'] : []
    };
  }

  // ===== AGGREGATE METRICS =====

  /**
   * Calculate aggregate metrics across all evidence
   */
  private calculateAggregateMetrics(
    scores: EvidenceScore[],
    aiAnalysis: AIAnalysis
  ): EvaluationResult['aggregateMetrics'] {
    if (scores.length === 0) {
      return {
        averageCredibility: 0,
        averageRelevance: 0,
        averageFreshness: 0,
        totalEvidence: 0,
        highQualityCount: 0,
        contradictionCount: 0,
        corroborationCount: 0
      };
    }

    const averageCredibility = Math.round(
      scores.reduce((sum, s) => sum + s.credibilityScore, 0) / scores.length
    );

    const averageRelevance = Math.round(
      scores.reduce((sum, s) => sum + s.relevanceScore, 0) / scores.length
    );

    const averageFreshness = Math.round(
      scores.reduce((sum, s) => sum + s.freshnessScore, 0) / scores.length
    );

    const highQualityCount = scores.filter(s => s.finalScore >= 80).length;

    return {
      averageCredibility,
      averageRelevance,
      averageFreshness,
      totalEvidence: scores.length,
      highQualityCount,
      contradictionCount: aiAnalysis.contradictions.length,
      corroborationCount: aiAnalysis.corroboration.length
    };
  }

  // ===== RECOMMENDATIONS =====

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(
    scores: EvidenceScore[],
    aiAnalysis: AIAnalysis,
    metrics: EvaluationResult['aggregateMetrics']
  ): string[] {
    const recommendations: string[] = [];

    // Evidence quality recommendations
    if (metrics.highQualityCount < 3) {
      recommendations.push('⚠️ Limited high-quality evidence. Seek additional authoritative sources.');
    }

    if (metrics.averageCredibility < 70) {
      recommendations.push('⚠️ Low average source credibility. Prioritize reputable sources.');
    }

    // Freshness recommendations
    if (metrics.averageFreshness < 60) {
      recommendations.push('📅 Evidence may be outdated. Look for more recent sources.');
    }

    // Consistency recommendations
    if (aiAnalysis.contradictions.length > 0) {
      recommendations.push(`⚠️ ${aiAnalysis.contradictions.length} contradictions found. Investigate conflicting claims.`);
    }

    if (aiAnalysis.gaps.length > 0) {
      recommendations.push('🔍 Information gaps identified. Additional research needed.');
    }

    // Verdict-based recommendations
    if (aiAnalysis.overallVerdict === 'INSUFFICIENT') {
      recommendations.push('❌ Insufficient evidence for verification. Conduct more research.');
    } else if (aiAnalysis.confidence < 70) {
      recommendations.push('⚠️ Low confidence level. Verify with additional sources.');
    }

    // Positive recommendations
    if (metrics.highQualityCount >= 5 && aiAnalysis.confidence >= 80) {
      recommendations.push('✅ Strong evidence base with high-quality sources.');
    }

    return recommendations;
  }

  // ===== FALLBACK =====

  /**
   * Create fallback result if evaluation fails
   */
  private createFallbackResult(
    evidence: Evidence[],
    claim: string,
    processingTime: number
  ): EvaluationResult {
    const scores = evidence.map(e => ({
      evidenceId: e.id,
      credibilityScore: e.credibilityScore,
      relevanceScore: e.relevanceScore,
      freshnessScore: 50,
      consistencyScore: 50,
      finalScore: Math.round((e.credibilityScore + e.relevanceScore) / 2),
      reasoning: 'Fallback scoring due to evaluation error'
    }));

    return {
      scores,
      aiAnalysis: {
        overallVerdict: 'INSUFFICIENT',
        confidence: 40,
        reasoning: 'Analysis could not be completed due to an error',
        contradictions: [],
        corroboration: [],
        gaps: ['Evaluation failed']
      },
      aggregateMetrics: {
        averageCredibility: evidence.length > 0 
          ? Math.round(evidence.reduce((sum, e) => sum + e.credibilityScore, 0) / evidence.length)
          : 0,
        averageRelevance: 50,
        averageFreshness: 50,
        totalEvidence: evidence.length,
        highQualityCount: evidence.filter(e => e.credibilityScore >= 80).length,
        contradictionCount: 0,
        corroborationCount: 0
      },
      recommendations: ['⚠️ Evaluation encountered errors. Results may be incomplete.'],
      processingTimeMs: processingTime
    };
  }
}

// Export singleton instance
export const evidenceEvaluator = EvidenceEvaluationService.getInstance();
