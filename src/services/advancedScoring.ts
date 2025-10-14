import { EvidenceItem } from '@/types';
import { AdvancedEvidence } from '@/types/enhancedFactCheck';
import { getSourceReliability } from '../data/sourceReliability';
import { calculateRecency } from '../utils/time';

export class AdvancedEvidenceScorer {

  calculateAdvancedScore(evidence: AdvancedEvidence): number {
    const weights = {
      sourceCredibility: 0.35,
      authorCredibility: 0.15,
      recency: 0.20,
      relevanceScore: 0.25,
      factCheckVerdict: 0.05
    };

    let score = 0;
    score += evidence.sourceCredibility * weights.sourceCredibility;
    score += evidence.authorCredibility * weights.authorCredibility;
    score += evidence.recency * weights.recency;
    score += evidence.relevanceScore * weights.relevanceScore;

    // Fact-check verdict bonus/penalty
    switch (evidence.factCheckVerdict) {
      case 'true':
        score += 10 * weights.factCheckVerdict;
        break;
      case 'false':
        score -= 20 * weights.factCheckVerdict;
        break;
      case 'mixed':
        score += 2 * weights.factCheckVerdict;
        break;
      default:
        // No adjustment for 'unproven' or 'unknown'
        break;
    }

    // Ensure score is within bounds
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  enhanceEvidenceWithMetadata(evidence: EvidenceItem): AdvancedEvidence {
    const url = new URL(evidence.url || 'https://unknown.com');
    const domain = url.hostname;
    const sourceInfo = getSourceReliability(domain);

    return {
      ...evidence,
      sourceCredibility: sourceInfo?.reliabilityScore || 50,
      authorCredibility: this.estimateAuthorCredibility(domain, sourceInfo?.category),
      // FIX: Added a check for publishedDate to ensure it's not undefined before calculating recency.
      recency: calculateRecency(evidence.publishedDate ?? new Date().toISOString()),
      // FIX: Added a nullish coalescing operator to provide a default empty string,
      // which resolves the 'is not assignable to type string' error.
      relevanceScore: this.calculateRelevance(evidence.quote ?? ''),
      contradictsClaim: false, // Will be determined by AI analysis
      supportsClaim: true, // Will be determined by AI analysis
      factCheckVerdict: 'unknown',
      biasScore: this.calculateBiasScore(sourceInfo?.biasRating),
      lastVerified: new Date().toISOString(),
    };
  }

  private estimateAuthorCredibility(domain: string, category?: string): number {
    switch (category) {
      case 'academic': return 90;
      case 'government': return 85;
      case 'fact_check': return 80;
      case 'news': return 70;
      default: return 50;
    }
  }

  private calculateRelevance(quote: string): number {
    // Simple relevance calculation based on quote length and content
    if (!quote) return 0; // Return 0 if quote is empty
    const wordCount = quote.split(' ').length;
    if (wordCount > 20 && wordCount < 200) return 85;
    if (wordCount > 10) return 70;
    return 50;
  }

  private calculateBiasScore(biasRating?: string): number {
    switch (biasRating) {
      case 'left': return -30;
      case 'center-left': return -15;
      case 'center': return 0;
      case 'center-right': return 15;
      case 'right': return 30;
      default: return 0;
    }
  }
}
