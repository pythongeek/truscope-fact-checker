// src/services/EvidenceEvaluationService.ts
import { vertexAiService } from './vertexAiService';
import { Evidence, EvidenceItem } from '../types';
import { logger } from '../utils/logger';

/**
 * Enhanced evidence item with AI-powered analysis
 */
export interface EvaluatedEvidence extends Evidence {
  aiAnalysis: {
    relevanceScore: number; // 0-100: How relevant to the claim
    credibilityAssessment: string; // AI's reasoning for credibility
    keyQuotes: string[]; // Extracted important quotes
    contradictions: string[]; // Conflicting information found
    supportType: 'strong_support' | 'weak_support' | 'neutral' | 'contradicts' | 'unrelated';
    biasIndicators: string[];
    temporalRelevance: 'current' | 'outdated' | 'timeless' | 'future';
    factualClaims: string[]; // Specific factual claims made in this source
  };
  enhancedScore: number; // Final AI-weighted score (0-100)
}

/**
 * Batch evaluation result
 */
export interface EvidenceBatchEvaluation {
  evaluatedEvidence: EvaluatedEvidence[];
  overallConsensus: {
    supportingCount: number;
    contradictingCount: number;
    neutralCount: number;
    consensusScore: number; // 0-100: Agreement level
    majorContradictions: string[];
    reliableSourcesCount: number;
  };
  recommendations: string[];
  processingTime: number;
}

/**
 * Cross-reference analysis between sources
 */
interface CrossReferenceAnalysis {
  sourceId1: string;
  sourceId2: string;
  agreementScore: number; // 0-100
  contradictionPoints: string[];
  corroboratingPoints: string[];
}

/**
 * Industry-standard evidence evaluation using Vertex AI for deep analysis
 * This eliminates statistical averaging in favor of intelligent assessment
 */
export class EvidenceEvaluationService {
  private static instance: EvidenceEvaluationService;

  private constructor() {}

  static getInstance(): EvidenceEvaluationService {
    if (!this.instance) {
      this.instance = new EvidenceEvaluationService();
    }
    return this.instance;
  }

  /**
   * MAIN METHOD: Evaluate all evidence for a claim using AI analysis
   */
  async evaluateEvidenceBatch(
    claim: string,
    evidenceItems: Evidence[],
    atomicClaims?: string[]
  ): Promise<EvidenceBatchEvaluation> {
    const startTime = Date.now();
    
    logger.info('🔬 Starting AI-powered evidence evaluation', {
      claim: claim.substring(0, 100),
      evidenceCount: evidenceItems.length
    });

    if (evidenceItems.length === 0) {
      return this.createEmptyEvaluation();
    }

    // Step 1: Evaluate each piece of evidence individually
    const evaluatedEvidence = await this.evaluateIndividualEvidence(
      claim,
      evidenceItems,
      atomicClaims
    );

    // Step 2: Cross-reference analysis
    const crossReferences = await this.performCrossReferenceAnalysis(
      claim,
      evaluatedEvidence
    );

    // Step 3: Calculate overall consensus
    const overallConsensus = this.calculateConsensus(evaluatedEvidence, crossReferences);

    // Step 4: Generate recommendations
    const recommendations = this.generateRecommendations(
      evaluatedEvidence,
      overallConsensus
    );

    const result: EvidenceBatchEvaluation = {
      evaluatedEvidence,
      overallConsensus,
      recommendations,
      processingTime: Date.now() - startTime
    };

    logger.info('✅ Evidence evaluation complete', {
      processingTime: result.processingTime,
      consensusScore: overallConsensus.consensusScore,
      supportingCount: overallConsensus.supportingCount
    });

    return result;
  }

  /**
   * Evaluate each evidence item individually using AI
   */
  private async evaluateIndividualEvidence(
    claim: string,
    evidenceItems: Evidence[],
    atomicClaims?: string[]
  ): Promise<EvaluatedEvidence[]> {
    logger.info('📊 Evaluating individual evidence items');

    // Process in batches of 5 to avoid token limits
    const batchSize = 5;
    const batches: Evidence[][] = [];
    
    for (let i = 0; i < evidenceItems.length; i += batchSize) {
      batches.push(evidenceItems.slice(i, i + batchSize));
    }

    const allEvaluated: EvaluatedEvidence[] = [];

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      logger.info(`Processing batch ${i + 1}/${batches.length}`);

      const batchResults = await Promise.all(
        batch.map(evidence => this.evaluateSingleEvidence(claim, evidence, atomicClaims))
      );

      allEvaluated.push(...batchResults);
    }

    return allEvaluated;
  }

  /**
   * Evaluate a single piece of evidence with AI
   */
  private async evaluateSingleEvidence(
    claim: string,
    evidence: Evidence,
    atomicClaims?: string[]
  ): Promise<EvaluatedEvidence> {
    const atomicClaimsStr = atomicClaims?.length 
      ? `\n\nATOMIC CLAIMS TO VERIFY:\n${atomicClaims.map((c, i) => `${i + 1}. ${c}`).join('\n')}`
      : '';

    const prompt = `You are a professional fact-checker evaluating a source. Analyze this evidence critically and objectively.

CLAIM TO VERIFY: "${claim}"${atomicClaimsStr}

EVIDENCE SOURCE:
- Publisher: ${evidence.publisher}
- URL: ${evidence.url}
- Credibility Score: ${evidence.credibilityScore}/100
- Publication Date: ${evidence.publicationDate || 'Unknown'}
- Content: "${(evidence.snippet || evidence.quote || '').substring(0, 500)}"

Your task: Evaluate this source's relevance, credibility, and contribution to verifying the claim.

Respond with ONLY valid JSON:
{
  "relevanceScore": 85,
  "credibilityAssessment": "brief reasoning for the score",
  "keyQuotes": ["important quote 1", "important quote 2"],
  "contradictions": ["any contradictions found"],
  "supportType": "strong_support",
  "biasIndicators": ["any bias detected"],
  "temporalRelevance": "current",
  "factualClaims": ["specific facts stated"],
  "enhancedScore": 88
}

Score Guidelines:
- relevanceScore: How directly this addresses the claim (0-100)
- enhancedScore: Overall value of this evidence (0-100), considering credibility, relevance, and recency
- supportType: "strong_support" (clearly supports), "weak_support" (partially supports), "neutral" (tangential), "contradicts" (opposes claim), "unrelated" (off-topic)`;

    try {
      const response = await vertexAiService.generateText(prompt, {
        temperature: 0.2,
        maxOutputTokens: 1500
      });

      const cleaned = this.cleanJsonResponse(response);
      const analysis = JSON.parse(cleaned);

      return {
        ...evidence,
        aiAnalysis: {
          relevanceScore: analysis.relevanceScore || 50,
          credibilityAssessment: analysis.credibilityAssessment || 'No assessment',
          keyQuotes: analysis.keyQuotes || [],
          contradictions: analysis.contradictions || [],
          supportType: analysis.supportType || 'neutral',
          biasIndicators: analysis.biasIndicators || [],
          temporalRelevance: analysis.temporalRelevance || 'timeless',
          factualClaims: analysis.factualClaims || []
        },
        enhancedScore: analysis.enhancedScore || evidence.credibilityScore || 50,
        relevanceScore: analysis.relevanceScore || 50
      };
    } catch (error) {
      logger.warn('AI evaluation failed for evidence, using fallback', {
        evidenceId: evidence.id,
        error
      });
      
      return this.createFallbackEvaluation(evidence);
    }
  }

  /**
   * Cross-reference analysis: Find agreements and contradictions between sources
   */
  private async performCrossReferenceAnalysis(
    claim: string,
    evidenceItems: EvaluatedEvidence[]
  ): Promise<CrossReferenceAnalysis[]> {
    // Only cross-reference high-quality sources to save API calls
    const highQualitySources = evidenceItems
      .filter(e => e.enhancedScore >= 70)
      .slice(0, 10); // Limit to top 10

    if (highQualitySources.length < 2) {
      return [];
    }

    logger.info('🔗 Performing cross-reference analysis', {
      sourcesCount: highQualitySources.length
    });

    const comparisons: CrossReferenceAnalysis[] = [];

    // Compare each source with others (limit comparisons to avoid API overload)
    const maxComparisons = 15;
    let comparisonCount = 0;

    for (let i = 0; i < highQualitySources.length && comparisonCount < maxComparisons; i++) {
      for (let j = i + 1; j < highQualitySources.length && comparisonCount < maxComparisons; j++) {
        const source1 = highQualitySources[i];
        const source2 = highQualitySources[j];

        const comparison = await this.compareEvidence(claim, source1, source2);
        comparisons.push(comparison);
        comparisonCount++;
      }
    }

    return comparisons;
  }

  /**
   * Compare two evidence sources for agreement/contradiction
   */
  private async compareEvidence(
    claim: string,
    evidence1: EvaluatedEvidence,
    evidence2: EvaluatedEvidence
  ): Promise<CrossReferenceAnalysis> {
    const prompt = `Compare these two sources regarding a claim. Identify agreements and contradictions.

CLAIM: "${claim}"

SOURCE 1 (${evidence1.publisher}):
"${(evidence1.snippet || evidence1.quote || '').substring(0, 300)}"
Key Facts: ${evidence1.aiAnalysis.factualClaims.join('; ')}

SOURCE 2 (${evidence2.publisher}):
"${(evidence2.snippet || evidence2.quote || '').substring(0, 300)}"
Key Facts: ${evidence2.aiAnalysis.factualClaims.join('; ')}

Respond with ONLY valid JSON:
{
  "agreementScore": 75,
  "contradictionPoints": ["specific contradiction"],
  "corroboratingPoints": ["specific agreement"]
}`;

    try {
      const response = await vertexAiService.generateText(prompt, {
        temperature: 0.1,
        maxOutputTokens: 1000
      });

      const cleaned = this.cleanJsonResponse(response);
      const result = JSON.parse(cleaned);

      return {
        sourceId1: evidence1.id,
        sourceId2: evidence2.id,
        agreementScore: result.agreementScore || 50,
        contradictionPoints: result.contradictionPoints || [],
        corroboratingPoints: result.corroboratingPoints || []
      };
    } catch (error) {
      logger.warn('Cross-reference comparison failed', { error });
      return {
        sourceId1: evidence1.id,
        sourceId2: evidence2.id,
        agreementScore: 50,
        contradictionPoints: [],
        corroboratingPoints: []
      };
    }
  }

  /**
   * Calculate overall consensus from evaluated evidence
   */
  private calculateConsensus(
    evidenceItems: EvaluatedEvidence[],
    crossReferences: CrossReferenceAnalysis[]
  ): EvidenceBatchEvaluation['overallConsensus'] {
    const supportingCount = evidenceItems.filter(
      e => e.aiAnalysis.supportType === 'strong_support' || e.aiAnalysis.supportType === 'weak_support'
    ).length;

    const contradictingCount = evidenceItems.filter(
      e => e.aiAnalysis.supportType === 'contradicts'
    ).length;

    const neutralCount = evidenceItems.filter(
      e => e.aiAnalysis.supportType === 'neutral' || e.aiAnalysis.supportType === 'unrelated'
    ).length;

    const reliableSourcesCount = evidenceItems.filter(
      e => e.enhancedScore >= 80
    ).length;

    // Calculate consensus score
    const avgAgreementScore = crossReferences.length > 0
      ? crossReferences.reduce((sum, cr) => sum + cr.agreementScore, 0) / crossReferences.length
      : 50;

    const supportRatio = supportingCount / Math.max(1, evidenceItems.length);
    const reliabilityRatio = reliableSourcesCount / Math.max(1, evidenceItems.length);

    const consensusScore = Math.round(
      (avgAgreementScore * 0.4) +
      (supportRatio * 100 * 0.4) +
      (reliabilityRatio * 100 * 0.2)
    );

    // Collect major contradictions
    const majorContradictions = crossReferences
      .filter(cr => cr.contradictionPoints.length > 0 && cr.agreementScore < 50)
      .flatMap(cr => cr.contradictionPoints);

    return {
      supportingCount,
      contradictingCount,
      neutralCount,
      consensusScore,
      majorContradictions: [...new Set(majorContradictions)], // Deduplicate
      reliableSourcesCount
    };
  }

  /**
   * Generate actionable recommendations based on evidence analysis
   */
  private generateRecommendations(
    evidenceItems: EvaluatedEvidence[],
    consensus: EvidenceBatchEvaluation['overallConsensus']
  ): string[] {
    const recommendations: string[] = [];

    // Check evidence quantity
    if (evidenceItems.length < 3) {
      recommendations.push('⚠️ LIMITED EVIDENCE: Only ' + evidenceItems.length + ' sources found. Seek additional verification.');
    }

    // Check source reliability
    if (consensus.reliableSourcesCount < 2) {
      recommendations.push('⚠️ LOW RELIABILITY: Fewer than 2 high-credibility sources (≥80%). Verify with authoritative sources.');
    }

    // Check for contradictions
    if (consensus.majorContradictions.length > 0) {
      recommendations.push(`⚠️ CONTRADICTIONS FOUND: ${consensus.majorContradictions.length} conflicting points between sources. Review carefully.`);
    }

    // Check consensus
    if (consensus.consensusScore < 60) {
      recommendations.push('⚠️ LOW CONSENSUS: Sources show significant disagreement. Claim requires further investigation.');
    }

    // Check for bias
    const biasedSources = evidenceItems.filter(e => e.aiAnalysis.biasIndicators.length > 0);
    if (biasedSources.length > evidenceItems.length * 0.5) {
      recommendations.push('⚠️ BIAS DETECTED: More than half of sources show potential bias. Seek neutral perspectives.');
    }

    // Check temporal relevance
    const outdatedSources = evidenceItems.filter(e => e.aiAnalysis.temporalRelevance === 'outdated');
    if (outdatedSources.length > evidenceItems.length * 0.5) {
      recommendations.push('⚠️ OUTDATED SOURCES: Many sources are outdated. Verify if claim is still accurate.');
    }

    // Positive indicators
    if (consensus.consensusScore >= 80 && consensus.reliableSourcesCount >= 3) {
      recommendations.push('✅ STRONG VERIFICATION: High consensus with multiple reliable sources.');
    }

    if (recommendations.length === 0) {
      recommendations.push('ℹ️ Evidence is adequate but not conclusive. Standard editorial review recommended.');
    }

    return recommendations;
  }

  // ===== Helper Methods =====

  private cleanJsonResponse(response: string): string {
    return response
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .replace(/^[^{[]*/, '')
      .replace(/[^}\]]*$/, '')
      .trim();
  }

  private createFallbackEvaluation(evidence: Evidence): EvaluatedEvidence {
    return {
      ...evidence,
      aiAnalysis: {
        relevanceScore: 50,
        credibilityAssessment: 'AI evaluation unavailable',
        keyQuotes: [],
        contradictions: [],
        supportType: 'neutral',
        biasIndicators: [],
        temporalRelevance: 'timeless',
        factualClaims: []
      },
      enhancedScore: evidence.credibilityScore || 50,
      relevanceScore: 50
    };
  }

  private createEmptyEvaluation(): EvidenceBatchEvaluation {
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
      recommendations: ['❌ NO EVIDENCE: No sources found to verify this claim.'],
      processingTime: 0
    };
  }
}

// Export singleton instance
export const evidenceEvaluationService = EvidenceEvaluationService.getInstance();
