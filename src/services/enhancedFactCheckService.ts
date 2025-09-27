import { FactCheckReport } from '../types/factCheck';
import { CitationAugmentedService } from './analysis/CitationAugmentedService';
import { TemporalContextService } from './core/TemporalContextService';
import { SourceCredibilityService } from './core/SourceCredibilityService';
import { CategoryRatingService } from './core/CategoryRatingService';

export type FactCheckMethod =
  | 'comprehensive'
  | 'citation-augmented'
  | 'cross-validation'
  | 'temporal-focus'
  | 'source-priority';

export class EnhancedFactCheckService {
  private citationService: CitationAugmentedService;
  private temporalService: TemporalContextService;
  private credibilityService: SourceCredibilityService;
  private ratingService: CategoryRatingService;

  constructor() {
    this.citationService = new CitationAugmentedService();
    this.temporalService = TemporalContextService.getInstance();
    this.credibilityService = SourceCredibilityService.getInstance();
    this.ratingService = CategoryRatingService.getInstance();
  }

  async orchestrateFactCheck(text: string, method: FactCheckMethod): Promise<FactCheckReport> {
    const startTime = Date.now();

    try {
      switch (method) {
        case 'comprehensive':
          return await this.runComprehensiveAnalysis(text);

        case 'citation-augmented':
          return await this.runCitationAugmentedAnalysis(text);

        case 'temporal-focus':
          return await this.runTemporalFocusedAnalysis(text);

        case 'source-priority':
          return await this.runSourcePriorityAnalysis(text);

        default:
          return await this.runCitationAugmentedAnalysis(text); // Default fallback
      }
    } catch (error) {
      // Fallback error report
      return this.generateErrorReport(text, method, error, Date.now() - startTime);
    }
  }

  private async runComprehensiveAnalysis(text: string): Promise<FactCheckReport> {
    // Run citation-augmented as base, then enhance
    const baseReport = await this.citationService.performCitationAugmentedAnalysis(text);

    // Add source credibility analysis
    const sourceAnalyses = await Promise.all(
      baseReport.evidence.map(evidence =>
        evidence.url ? this.credibilityService.analyzeSource(evidence.url) : null
      )
    );

    // Recalculate with source credibility weighting
    const enhancedScore = this.credibilityService.calculateWeightedScore(baseReport.evidence);
    const biasWarnings = this.credibilityService.getBiasWarnings(
      baseReport.evidence.map(e => ({ url: e.url }))
    );

    // Generate category rating
    const categoryRating = this.ratingService.convertScoreToCategory(
      enhancedScore,
      this.calculateEvidenceQuality(sourceAnalyses),
      baseReport.evidence.length
    );

    return {
      ...baseReport,
      final_score: enhancedScore,
      final_verdict: `Comprehensive analysis: ${categoryRating.reasoning}`,
      category_rating: categoryRating,
      source_credibility_analysis: {
        analyses: sourceAnalyses.filter(s => s !== null),
        averageCredibility: this.calculateAverageCredibility(sourceAnalyses),
        biasWarnings,
        credibilityWarnings: this.generateCredibilityWarnings(sourceAnalyses),
        highCredibilitySources: sourceAnalyses.filter(s => s && s.credibilityScore >= 85).length,
        flaggedSources: sourceAnalyses.filter(s => s && s.verificationStatus === 'flagged').length
      },
      metadata: {
        ...baseReport.metadata,
        method_used: 'comprehensive',
        warnings: [
          ...baseReport.metadata.warnings,
          ...biasWarnings
        ]
      }
    };
  }

  private async runCitationAugmentedAnalysis(text: string): Promise<FactCheckReport> {
    const report = await this.citationService.performCitationAugmentedAnalysis(text);

    // Add category rating
    const categoryRating = this.ratingService.convertScoreToCategory(
      report.final_score,
      70, // Default evidence quality
      report.evidence.length
    );

    return {
      ...report,
      category_rating: categoryRating
    };
  }

  private async runTemporalFocusedAnalysis(text: string): Promise<FactCheckReport> {
    const temporalValidations = this.temporalService.evaluateTemporalClaims(text);

    // Enhanced temporal analysis with claim verification
    const baseReport = await this.citationService.performCitationAugmentedAnalysis(text);

    // Adjust score based on temporal accuracy
    const temporalScore = temporalValidations.filter(v => v.isValid).length / Math.max(temporalValidations.length, 1) * 100;
    const adjustedScore = Math.round((baseReport.final_score * 0.6) + (temporalScore * 0.4));

    const categoryRating = this.ratingService.convertScoreToCategory(
      adjustedScore,
      70,
      baseReport.evidence.length
    );

    return {
      ...baseReport,
      final_score: adjustedScore,
      final_verdict: `Temporal-focused analysis: ${this.generateTemporalVerdict(adjustedScore, temporalValidations)}`,
      category_rating: categoryRating,
      temporal_analysis: {
        hasTemporalClaims: temporalValidations.length > 0,
        validations: temporalValidations,
        overallTemporalScore: temporalScore,
        temporalWarnings: temporalValidations.filter(v => !v.isValid).map(v => v.reasoning)
      },
      metadata: {
        ...baseReport.metadata,
        method_used: 'temporal-focus',
        warnings: [
          ...baseReport.metadata.warnings,
          ...temporalValidations.filter(v => !v.isValid).map(v => `Temporal issue: ${v.reasoning}`)
        ]
      }
    };
  }

  private async runSourcePriorityAnalysis(text: string): Promise<FactCheckReport> {
    const baseReport = await this.citationService.performCitationAugmentedAnalysis(text);

    // Analyze all sources for credibility
    const sourceAnalyses = await Promise.all(
      baseReport.evidence.map(evidence =>
        evidence.url ? this.credibilityService.analyzeSource(evidence.url) : null
      )
    );

    // Recalculate score with heavy source credibility weighting
    const enhancedScore = this.credibilityService.calculateWeightedScore(baseReport.evidence);
    const biasWarnings = this.credibilityService.getBiasWarnings(
      baseReport.evidence.map(e => ({ url: e.url }))
    );

    const categoryRating = this.ratingService.convertScoreToCategory(
      enhancedScore,
      this.calculateEvidenceQuality(sourceAnalyses),
      baseReport.evidence.length
    );

    return {
      ...baseReport,
      final_score: enhancedScore,
      final_verdict: `Source-priority analysis: ${this.generateSourceBasedVerdict(enhancedScore, sourceAnalyses)}`,
      category_rating: categoryRating,
      source_credibility_analysis: {
        analyses: sourceAnalyses.filter(s => s !== null),
        averageCredibility: this.calculateAverageCredibility(sourceAnalyses),
        biasWarnings,
        credibilityWarnings: this.generateCredibilityWarnings(sourceAnalyses),
        highCredibilitySources: sourceAnalyses.filter(s => s && s.credibilityScore >= 85).length,
        flaggedSources: sourceAnalyses.filter(s => s && s.verificationStatus === 'flagged').length
      },
      metadata: {
        ...baseReport.metadata,
        method_used: 'source-priority',
        warnings: [
          ...baseReport.metadata.warnings,
          ...biasWarnings
        ]
      }
    };
  }

  private generateTemporalVerdict(score: number, validations: any[]): string {
    const invalidCount = validations.filter(v => !v.isValid).length;

    if (invalidCount === 0 && score >= 80) return 'Temporally consistent and factually accurate';
    if (invalidCount === 0) return 'Temporally consistent but factual accuracy varies';
    if (invalidCount === 1) return 'Minor temporal inconsistency detected';
    return 'Multiple temporal issues require attention';
  }

  private generateSourceBasedVerdict(score: number, sourceAnalyses: any[]): string {
    const validSources = sourceAnalyses.filter(s => s !== null);
    const highCredibility = validSources.filter(s => s.credibilityScore >= 80).length;
    const flagged = validSources.filter(s => s.verificationStatus === 'flagged').length;

    if (flagged > 0) return `Caution: ${flagged} flagged source(s) detected`;
    if (highCredibility >= 3) return 'Strong source credibility foundation';
    if (highCredibility >= 1) return 'Good source credibility with some limitations';
    return 'Limited high-credibility sources available';
  }

  private calculateEvidenceQuality(sourceAnalyses: any[]): number {
    const validSources = sourceAnalyses.filter(s => s !== null);
    if (validSources.length === 0) return 30;

    return validSources.reduce((sum: number, source: any) => sum + source.credibilityScore, 0) / validSources.length;
  }

  private calculateAverageCredibility(sourceAnalyses: any[]): number {
    const validSources = sourceAnalyses.filter(s => s !== null);
    if (validSources.length === 0) return 0;

    return Math.round(validSources.reduce((sum: number, source: any) => sum + source.credibilityScore, 0) / validSources.length);
  }

  private generateCredibilityWarnings(sourceAnalyses: any[]): string[] {
    const warnings: string[] = [];
    const validSources = sourceAnalyses.filter(s => s !== null);

    const lowCredibilityCount = validSources.filter(s => s.credibilityScore < 50).length;
    const flaggedCount = validSources.filter(s => s.verificationStatus === 'flagged').length;

    if (lowCredibilityCount > 0) {
      warnings.push(`${lowCredibilityCount} source(s) have low credibility scores`);
    }

    if (flaggedCount > 0) {
      warnings.push(`${flaggedCount} source(s) are flagged as potentially unreliable`);
    }

    return warnings;
  }

  private generateErrorReport(text: string, method: FactCheckMethod, error: any, processingTime: number): FactCheckReport {
    return {
      final_verdict: 'Analysis failed due to technical error',
      final_score: 0,
      reasoning: `Error during ${method} analysis: ${error instanceof Error ? error.message : 'Unknown error'}`,
      evidence: [],
      originalText: text,
      metadata: {
        method_used: method,
        processing_time_ms: processingTime,
        apis_used: ['error-handling'],
        sources_consulted: { total: 0, high_credibility: 0, conflicting: 0 },
        warnings: [`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      },
      score_breakdown: {
        final_score_formula: 'Error - unable to calculate',
        metrics: []
      }
    };
  }
}