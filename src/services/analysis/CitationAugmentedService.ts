import { TemporalContextService } from '../core/TemporalContextService';
import { SourceCredibilityService } from '../core/SourceCredibilityService';
import { FactCheckReport, EvidenceItem } from '../../types/factCheck';
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
      // Step 1: Segment the text into claims
      const claimSegments = this.segmentTextIntoClaims(text);

      // Step 2: Analyze each segment
      const segmentAnalyses = await Promise.all(
        claimSegments.map(segment => this.analyzeClaim(segment))
      );

      // Step 3: Temporal analysis
      const temporalAnalysis = this.temporalService.evaluateTemporalClaims(text);

      // Step 4: Aggregate results
      const finalReport = await this.aggregateAnalysis(text, segmentAnalyses, temporalAnalysis);

      return finalReport;
    } catch (error) {
      throw new Error(`Citation-Augmented Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private segmentTextIntoClaims(text: string): string[] {
    // Intelligent text segmentation based on claim boundaries
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const segments: string[] = [];
    let currentSegment = '';

    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();

      // Check if this sentence contains a factual claim
      if (this.containsFactualClaim(trimmedSentence)) {
        if (currentSegment) {
          segments.push(currentSegment);
          currentSegment = '';
        }
        segments.push(trimmedSentence);
      } else {
        // Add to current segment as context
        currentSegment += (currentSegment ? '. ' : '') + trimmedSentence;
      }
    }

    if (currentSegment) {
      segments.push(currentSegment);
    }

    return segments.length > 0 ? segments : [text];
  }

  private containsFactualClaim(sentence: string): boolean {
    // Patterns that suggest factual claims
    const factualPatterns = [
      /\b\d+%\b/, // Percentages
      /\b\d+\s*(million|billion|thousand)\b/i, // Large numbers
      /\b(according to|study shows|research indicates|data shows)\b/i, // Citation indicators
      /\b(scientists|experts|researchers)\b/i, // Authority references
      /\b(caused by|leads to|results in|due to)\b/i, // Causal claims
      /\b(increase|decrease|rose|fell|grew|declined)\b/i, // Trend claims
      /\b(in \d{4}|last year|this year|since \d{4})\b/i // Time references
    ];

    return factualPatterns.some(pattern => pattern.test(sentence));
  }

  private async analyzeClaim(claimText: string): Promise<CitationContext> {
    try {
      // Search for evidence
      const evidence = await this.searchForEvidence(claimText);

      // Categorize evidence
      const supportingEvidence = evidence.filter(e => e.score >= 60);
      const contradictingEvidence = evidence.filter(e => e.score < 40);

      // Calculate confidence based on evidence quality and quantity
      const confidence = this.calculateClaimConfidence(supportingEvidence, contradictingEvidence);

      // Determine verification status
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
          score: credibilityData.credibilityScore,
          type: 'search_result',
        } as EvidenceItem;
      })
    );

    return evidenceItems.filter((item): item is EvidenceItem => item !== null);
  }

  private extractKeyTerms(claimText: string): string {
    // Extract the most important terms for searching
    const words = claimText.toLowerCase().split(/\s+/);
    const stopWords = new Set(['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were']);

    const keyWords = words
      .filter(word => !stopWords.has(word) && word.length > 3)
      .slice(0, 5); // Take top 5 key terms

    return keyWords.join(' ');
  }

  private calculateClaimConfidence(supporting: EvidenceItem[], contradicting: EvidenceItem[]): number {
    if (supporting.length === 0 && contradicting.length === 0) return 20;

    const supportingWeight = supporting.reduce((sum, e) => sum + e.score, 0);
    const contradictingWeight = contradicting.reduce((sum, e) => sum + (100 - e.score), 0);

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
    temporalAnalysis: any[]
  ): Promise<FactCheckReport> {
    // Calculate overall scores
    const overallConfidence = segmentAnalyses.reduce((sum, analysis) => sum + analysis.confidence, 0) / segmentAnalyses.length;
    const temporalScore = temporalAnalysis.filter(t => t.isValid).length / Math.max(temporalAnalysis.length, 1) * 100;

    // Combine temporal and claim scores
    const finalScore = Math.round((overallConfidence * 0.8) + (temporalScore * 0.2));

    // Generate evidence array
    const allEvidence = segmentAnalyses.flatMap(analysis => [
      ...analysis.supportingEvidence,
      ...analysis.contradictingEvidence
    ]);

    // Create segments for color coding
    const originalTextSegments = segmentAnalyses.map((analysis, index) => ({
      text: analysis.claimSegment,
      score: analysis.confidence,
      color: this.getColorForScore(analysis.confidence) as 'green' | 'yellow' | 'red'
    }));

    // Generate metadata
    const metadata = {
      method_used: 'citation-augmented',
      processing_time_ms: Date.now() - Date.now(), // Placeholder
      apis_used: ['internal-analysis', 'source-credibility'],
      sources_consulted: {
        total: allEvidence.length,
        high_credibility: allEvidence.filter(e => e.score >= 80).length,
        conflicting: segmentAnalyses.filter(a => a.verificationStatus === 'disputed').length
      },
      warnings: [
        ...temporalAnalysis.filter(t => !t.isValid).map(t => `Temporal issue: ${t.reasoning}`),
        ...(allEvidence.length < 3 ? ['Limited evidence available for comprehensive verification'] : [])
      ]
    };

    return {
      id: `report-${Date.now()}`,
      final_verdict: this.generateVerdict(finalScore, segmentAnalyses),
      final_score: finalScore,
      reasoning: this.generateReasoning(segmentAnalyses, temporalAnalysis),
      evidence: allEvidence,
      originalText,
      enhanced_claim_text: originalText, // Use original text as a fallback
      originalTextSegments,
      temporal_verification: {
        hasTemporalClaims: temporalAnalysis.length > 0,
        validations: temporalAnalysis,
        overallTemporalScore: temporalScore,
        temporalWarnings: temporalAnalysis.filter(t => !t.isValid).map(t => t.reasoning)
      },
      // Add missing required properties with default values
      source_credibility_report: {
        overallScore: 0,
        highCredibilitySources: 0,
        flaggedSources: 0,
        biasWarnings: [],
        credibilityBreakdown: { academic: 0, news: 0, government: 0, social: 0 }
      },
      user_category_recommendations: [],
      metadata,
      score_breakdown: {
        final_score_formula: 'Claim Confidence (80%) + Temporal Accuracy (20%)',
        metrics: [
          {
            name: 'Claim Verification',
            score: Math.round(overallConfidence),
            description: 'Average confidence across all identified claims'
          },
          {
            name: 'Temporal Accuracy',
            score: Math.round(temporalScore),
            description: 'Accuracy of time-based references'
          }
        ]
      }
    };
  }

  private getColorForScore(score: number): string {
    if (score >= 75) return 'green';
    if (score >= 50) return 'yellow';
    return 'red';
  }

  private generateVerdict(score: number, analyses: CitationContext[]): string {
    const disputedCount = analyses.filter(a => a.verificationStatus === 'disputed').length;
    const verifiedCount = analyses.filter(a => a.verificationStatus === 'verified').length;

    if (disputedCount > verifiedCount) {
      return 'Contains disputed claims requiring careful consideration';
    }

    if (score >= 85) return 'Highly accurate with strong supporting evidence';
    if (score >= 70) return 'Generally accurate with good supporting evidence';
    if (score >= 50) return 'Mixed accuracy - some claims verified, others questionable';
    if (score >= 30) return 'Questionable accuracy with limited supporting evidence';
    return 'Low accuracy with contradicting evidence';
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
                score: credibilityData.credibilityScore,
                type: 'search_result',
            } as EvidenceItem;
        })
    );

    const evidence = evidenceItems.filter((item): item is EvidenceItem => item !== null);

    const combinedScores = this.combineScores(evidence);
    const finalScore = this.calculateFinalScore(combinedScores);
    const finalVerdict = this.getVerdict(finalScore);

    const report: FactCheckReport = {
        id: `report-${Date.now()}`,
        originalText: claimText,
        final_verdict: finalVerdict,
        final_score: finalScore,
        reasoning: `Analysis based on ${evidence.length} search results.`,
        evidence: evidence,
        score_breakdown: {
            final_score_formula: "Weighted average of search metrics.",
            metrics: [
                { name: 'Source Reliability', score: combinedScores.source_reliability, description: 'Average reliability of sources' },
                { name: 'Corroboration', score: combinedScores.corroboration, description: 'Number of sources found' }
            ]
        },
        metadata: {
            method_used: 'citation-augmented-search',
            processing_time_ms: 0,
            apis_used: ['google-search'],
            sources_consulted: { total: evidence.length, high_credibility: evidence.filter(e => e.score >= 80).length, conflicting: 0 },
            warnings: []
        },
        // Add missing required properties with default values
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
        },
        user_category_recommendations: []
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

    const source_reliability = Math.round(evidence.reduce((acc, item) => acc + (item.score || 0), 0) / evidence.length);
    const corroboration = Math.min(100, evidence.length * 10);
    return {
        source_reliability,
        corroboration
    };
  }

  private calculateFinalScore(combinedScores: any): number {
    const { source_reliability, corroboration } = combinedScores;
    // 60% for reliability, 40% for corroboration
    return Math.round((source_reliability * 0.6) + (corroboration * 0.4));
  }

  private getVerdict(score: number): string {
    if (score >= 85) return 'Highly credible';
    if (score >= 70) return 'Credible';
    if (score >= 50) return 'Mixed';
    if (score >= 30) return 'Not credible';
    return 'Highly not credible';
  }
}