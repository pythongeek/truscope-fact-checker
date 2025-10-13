import { TemporalContextService } from '../core/TemporalContextService';
import { SourceCredibilityService } from '../core/SourceCredibilityService';
import { FactCheckReport, EvidenceItem, FactVerdict, Segment, FactCheckMetadata, ScoreBreakdown } from '@/types';
import { executeMultiStrategySearch } from '../webSearch';
import { generateSHA256 } from '../../utils/hashUtils';

export interface CitationContext {
  claimSegment: string;
  supportingEvidence: EvidenceItem[];
  contradictingEvidence: EvidenceItem[];
  confidence: number;
  verificationStatus: 'verified' | 'disputed' | 'unverifiable';
}

export class CitationAugmentedService {
  private temporalService: TemporalContextService;
  private credibilityService: SourceCredibilityService;

  constructor() {
    this.temporalService = TemporalContextService.getInstance();
    this.credibilityService = SourceCredibilityService.getInstance();
  }

  async performCitationAugmentedAnalysis(text: string): Promise<FactCheckReport> {
    try {
      const startTime = Date.now();
      const claimSegments = this.segmentTextIntoClaims(text);
      const segmentAnalyses = await Promise.all(
        claimSegments.map(segment => this.analyzeClaim(segment))
      );
      const temporalAnalysis = this.temporalService.evaluateTemporalClaims(text);
      const finalReport = await this.aggregateAnalysis(text, segmentAnalyses, temporalAnalysis, startTime);
      return finalReport;
    } catch (error) {
      throw new Error(`Citation-Augmented Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private segmentTextIntoClaims(text: string): string[] {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const segments: string[] = [];
    let currentSegment = '';

    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (this.containsFactualClaim(trimmedSentence)) {
        if (currentSegment) {
          segments.push(currentSegment);
        }
        segments.push(trimmedSentence);
        currentSegment = '';
      } else {
        currentSegment += (currentSegment ? '. ' : '') + trimmedSentence;
      }
    }

    if (currentSegment) {
      segments.push(currentSegment);
    }

    return segments.length > 0 ? segments : [text];
  }

  private containsFactualClaim(sentence: string): boolean {
    const factualPatterns = [
      /\b\d+%\b/,
      /\b\d+\s*(million|billion|thousand)\b/i,
      /\b(according to|study shows|research indicates|data shows)\b/i,
      /\b(scientists|experts|researchers)\b/i,
      /\b(caused by|leads to|results in|due to)\b/i,
      /\b(increase|decrease|rose|fell|grew|declined)\b/i,
      /\b(in \d{4}|last year|this year|since \d{4})\b/i
    ];
    return factualPatterns.some(pattern => pattern.test(sentence));
  }

  private async analyzeClaim(claimText: string): Promise<CitationContext> {
    try {
      const evidence = await this.searchForEvidence(claimText);
      const supportingEvidence = evidence.filter(e => e.relevanceScore >= 60);
      const contradictingEvidence = evidence.filter(e => e.relevanceScore < 40);
      const confidence = this.calculateClaimConfidence(supportingEvidence, contradictingEvidence);
      const verificationStatus = this.determineVerificationStatus(supportingEvidence, contradictingEvidence);

      return {
        claimSegment: claimText,
        supportingEvidence,
        contradictingEvidence,
        confidence,
        verificationStatus
      };
    } catch (error) {
      return {
        claimSegment: claimText,
        supportingEvidence: [],
        contradictingEvidence: [],
        confidence: 20,
        verificationStatus: 'unverifiable'
      };
    }
  }

  private async searchForEvidence(claimText: string): Promise<EvidenceItem[]> {
    const keywords = this.extractKeyTerms(claimText).split(' ');
    const searchResults = await executeMultiStrategySearch(claimText, keywords);

    if (!searchResults || searchResults.length === 0) {
      return [];
    }

    const evidenceItems = await Promise.all(
      searchResults.map(async (result) => {
        if (!result || !result.link) return null;

        const credibilityData = await this.credibilityService.analyzeSource(result.link);
        const evidenceId = await generateSHA256(result.link);

        return {
          id: evidenceId,
          quote: result.snippet,
          publisher: result.source,
          url: result.link,
          credibilityScore: credibilityData.credibilityScore,
          relevanceScore: credibilityData.credibilityScore, // Using credibility as relevance for now
          type: 'search_result',
        } as EvidenceItem;
      })
    );

    return evidenceItems.filter((item): item is EvidenceItem => item !== null);
  }

  private extractKeyTerms(claimText: string): string {
    const words = claimText.toLowerCase().split(/\s+/);
    const stopWords = new Set(['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were']);
    const keyWords = words.filter(word => !stopWords.has(word) && word.length > 3).slice(0, 5);
    return keyWords.join(' ');
  }

  private calculateClaimConfidence(supporting: EvidenceItem[], contradicting: EvidenceItem[]): number {
    if (supporting.length === 0 && contradicting.length === 0) return 20;

    const supportingWeight = supporting.reduce((sum, e) => sum + e.relevanceScore, 0);
    const contradictingWeight = contradicting.reduce((sum, e) => sum + (100 - e.relevanceScore), 0);
    const totalWeight = supportingWeight + contradictingWeight;

    if (totalWeight === 0) return 50;
    return Math.round((supportingWeight / totalWeight) * 100);
  }

  private determineVerificationStatus(supporting: EvidenceItem[], contradicting: EvidenceItem[]): 'verified' | 'disputed' | 'unverifiable' {
    const totalEvidence = supporting.length + contradicting.length;
    if (totalEvidence === 0) return 'unverifiable';
    if (contradicting.length > 0 && supporting.length > 0) return 'disputed';
    if (supporting.length >= 2) return 'verified';
    if (contradicting.length >= 2) return 'disputed';
    return 'unverifiable';
  }

  private async aggregateAnalysis(
    originalText: string,
    segmentAnalyses: CitationContext[],
    temporalAnalysis: any[],
    startTime: number
  ): Promise<FactCheckReport> {
    const overallConfidence = segmentAnalyses.reduce((sum, analysis) => sum + analysis.confidence, 0) / segmentAnalyses.length;
    const temporalScore = temporalAnalysis.filter(t => t.isValid).length / Math.max(temporalAnalysis.length, 1) * 100;
    const finalScore = Math.round((overallConfidence * 0.8) + (temporalScore * 0.2));

    const allEvidence = segmentAnalyses.flatMap(analysis => [...analysis.supportingEvidence, ...analysis.contradictingEvidence]);

    const originalTextSegments: Segment[] = segmentAnalyses.map((analysis) => ({
      text: analysis.claimSegment,
      score: analysis.confidence,
      color: this.getColorForScore(analysis.confidence) as 'green' | 'yellow' | 'red',
      isFact: true, // Assuming all segments are facts for now
    }));

    const metadata: FactCheckMetadata = {
      methodUsed: 'citation-augmented',
      processingTimeMs: Date.now() - startTime,
      apisUsed: ['internal-analysis', 'source-credibility'],
      sourcesConsulted: {
        total: allEvidence.length,
        highCredibility: allEvidence.filter(e => e.credibilityScore >= 80).length,
        conflicting: segmentAnalyses.filter(a => a.verificationStatus === 'disputed').length,
      },
      warnings: [
        ...temporalAnalysis.filter(t => !t.isValid).map(t => `Temporal issue: ${t.reasoning}`),
        ...(allEvidence.length < 3 ? ['Limited evidence available for comprehensive verification'] : [])
      ]
    };

    const score_breakdown: ScoreBreakdown = {
        finalScoreFormula: 'Claim Confidence (80%) + Temporal Accuracy (20%)',
        metrics: [
          {
            name: 'Claim Verification',
            score: Math.round(overallConfidence),
            description: 'Average confidence across all identified claims',
            reasoning: 'The confidence score is the average of all claim segments.'
          },
          {
            name: 'Temporal Accuracy',
            score: Math.round(temporalScore),
            description: 'Accuracy of time-based references',
            reasoning: 'The temporal score is the percentage of valid temporal claims.'
          }
        ],
        confidence_intervals: {
          lowerBound: finalScore - 5,
          upperBound: finalScore + 5,
        }
      };

    return {
      id: `report-${Date.now()}`,
      final_verdict: this.generateVerdict(finalScore, segmentAnalyses),
      final_score: finalScore,
      reasoning: this.generateReasoning(segmentAnalyses, temporalAnalysis),
      evidence: allEvidence,
      originalText,
      enhanced_claim_text: originalText,
      originalTextSegments,
      temporal_verification: {
        hasTemporalClaims: temporalAnalysis.length > 0,
        validations: temporalAnalysis,
        overallTemporalScore: temporalScore,
        temporalWarnings: temporalAnalysis.filter(t => !t.isValid).map(t => t.reasoning)
      },
      source_credibility_report: {
        overallScore: 0,
        highCredibilitySources: 0,
        flaggedSources: 0,
        biasWarnings: [],
        credibilityBreakdown: { academic: 0, news: 0, government: 0, social: 0 }
      },
      metadata,
      score_breakdown,
    };
  }

  private getColorForScore(score: number): string {
    if (score >= 75) return 'green';
    if (score >= 50) return 'yellow';
    return 'red';
  }

  private generateVerdict(score: number, analyses: CitationContext[]): FactVerdict {
    const disputedCount = analyses.filter(a => a.verificationStatus === 'disputed').length;
    const verifiedCount = analyses.filter(a => a.verificationStatus === 'verified').length;

    if (disputedCount > verifiedCount) {
      return 'contains disputed claims';
    }

    if (score >= 85) return 'highly accurate';
    if (score >= 70) return 'generally accurate';
    if (score >= 50) return 'mixed accuracy';
    if (score >= 30) return 'questionable accuracy';
    return 'low accuracy';
  }

  private generateReasoning(analyses: CitationContext[], temporalAnalysis: any[]): string {
    const claimCount = analyses.length;
    const verifiedCount = analyses.filter(a => a.verificationStatus === 'verified').length;
    const disputedCount = analyses.filter(a => a.verificationStatus === 'disputed').length;
    const temporalIssues = temporalAnalysis.filter(t => !t.isValid).length;

    let reasoning = `Analyzed ${claimCount} distinct claims. `;
    reasoning += `${verifiedCount} claims have supporting evidence, `;
    reasoning += `${disputedCount} claims have contradicting evidence. `;

    if (temporalIssues > 0) {
      reasoning += `${temporalIssues} temporal references may be inaccurate. `;
    }

    return reasoning;
  }

  public async processSearchResults(claimText: string, searchResults: any[]): Promise<FactCheckReport> {
    const evidenceItems: (EvidenceItem | null)[] = await Promise.all(
      searchResults.map(async (result) => {
        if (!result || !result.link) return null;

        const credibilityData = await this.credibilityService.analyzeSource(result.link);
        const evidenceId = await generateSHA256(result.link);

        return {
          id: evidenceId,
          quote: result.snippet,
          publisher: result.source,
          url: result.link,
          credibilityScore: credibilityData.credibilityScore,
          relevanceScore: credibilityData.credibilityScore, // Using credibility as relevance for now
          type: 'search_result',
        } as EvidenceItem;
      })
    );

    const evidence = evidenceItems.filter((item): item is EvidenceItem => item !== null);

    const combinedScores = this.combineScores(evidence);
    const finalScore = this.calculateFinalScore(combinedScores);
    const finalVerdict = this.getVerdict(finalScore);
    
    const score_breakdown: ScoreBreakdown = {
        finalScoreFormula: "Weighted average of search metrics.",
        metrics: [
          { name: 'Source Reliability', score: combinedScores.source_reliability, description: 'Average reliability of sources', reasoning: 'The reliability score is the average of all sources.' },
          { name: 'Corroboration', score: combinedScores.corroboration, description: 'Number of sources found', reasoning: 'The corroboration score is based on the number of sources found.' }
        ],
        confidence_intervals: {
          lowerBound: finalScore - 5,
          upperBound: finalScore + 5,
        }
      };

    const report: FactCheckReport = {
      id: `report-${Date.now()}`,
      originalText: claimText,
      final_verdict: finalVerdict,
      final_score: finalScore,
      reasoning: `Analysis based on ${evidence.length} search results.`,
      evidence: evidence,
      score_breakdown,
      metadata: {
        methodUsed: 'citation-augmented-search',
        processingTimeMs: 0,
        apisUsed: ['google-search'],
        sourcesConsulted: { total: evidence.length, highCredibility: evidence.filter(e => e.credibilityScore >= 80).length, conflicting: 0 },
        warnings: []
      },
      enhanced_claim_text: claimText,
      originalTextSegments: [],
      temporal_verification: {
        hasTemporalClaims: false,
        validations: [],
        overallTemporalScore: 0,
        temporalWarnings: []
      },
      source_credibility_report: {
        overallScore: 0,
        highCredibilitySources: 0,
        flaggedSources: 0,
        biasWarnings: [],
        credibilityBreakdown: { academic: 0, news: 0, government: 0, social: 0 }
      }
    };

    return report;
  }

  private combineScores(evidence: EvidenceItem[]): any {
    if (evidence.length === 0) {
      return {
        source_reliability: 0,
        corroboration: 0
      };
    }

    const source_reliability = Math.round(evidence.reduce((acc, item) => acc + (item.credibilityScore || 0), 0) / evidence.length);
    const corroboration = Math.min(100, evidence.length * 10);
    return {
      source_reliability,
      corroboration
    };
  }

  private calculateFinalScore(combinedScores: any): number {
    const { source_reliability, corroboration } = combinedScores;
    return Math.round((source_reliability * 0.6) + (corroboration * 0.4));
  }

  private getVerdict(score: number): FactVerdict {
    if (score >= 85) return 'highly credible';
    if (score >= 70) return 'credible';
    if (score >= 50) return 'mixed';
    if (score >= 30) return 'not credible';
    return 'highly not credible';
  }
}
