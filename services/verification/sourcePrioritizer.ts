import type { SourceItem, ClaimContext, PrioritizedSourceList, ClaimDomain, DomainWeights } from '../../types/verification';
import { executeGeminiQuery } from '../geminiService';
import { VerificationError } from '../../types/errorHandler';

/**
 * A class that prioritizes a list of sources based on their relevance to a specific claim.
 * It classifies the claim's domain, then scores sources based on domain-specific weights,
 * contextual relevance, and recency.
 */
export class SourcePrioritizer {
  constructor() {}

  /**
   * Predefined weights for different source categories based on the claim's domain.
   * @private
   */
  private readonly DOMAIN_WEIGHTS: { [key in ClaimDomain]: DomainWeights } = {
    political: { government: 0.35, factcheck: 0.25, news: 0.20, academic: 0.15, expert: 0.05, industry: 0.0 },
    scientific: { academic: 0.40, government: 0.25, expert: 0.20, news: 0.10, factcheck: 0.05, industry: 0.0 },
    financial: { government: 0.30, expert: 0.25, news: 0.20, academic: 0.15, factcheck: 0.10, industry: 0.1 },
    health: { academic: 0.35, government: 0.30, expert: 0.20, news: 0.10, factcheck: 0.05, industry: 0.0 },
    general: { factcheck: 0.25, news: 0.20, government: 0.20, academic: 0.20, expert: 0.15, industry: 0.0 }
  };

  /**
   * Ranks a list of sources according to their relevance and importance to a given claim.
   *
   * @param {string} claim - The claim being verified.
   * @param {SourceItem[]} availableSources - The list of sources to prioritize.
   * @param {ClaimContext} [claimContext] - Optional context about the claim.
   * @returns {Promise<PrioritizedSourceList>} A promise that resolves to the prioritized list of sources and analysis.
   * @throws {VerificationError} If the prioritization process fails.
   */
  async prioritizeSources(
    claim: string,
    availableSources: SourceItem[],
    claimContext?: ClaimContext
  ): Promise<PrioritizedSourceList> {
    try {
        const claimDomain = await this.classifyClaimDomain(claim);
        const weights = this.DOMAIN_WEIGHTS[claimDomain] || this.DOMAIN_WEIGHTS.general;

        const scoredSources = await Promise.all(
          availableSources.map(async source => {
            const baseScore = this.calculateBaseScore(source, weights);
            const contextScore = await this.calculateContextScore(source, claim);
            const recencyScore = this.calculateRecencyScore(source);
            const finalScore = (baseScore * 0.6) + (contextScore * 0.3) + (recencyScore * 0.1);
            return { source, priority_score: finalScore, ranking_factors: { domain_relevance: baseScore, context_relevance: contextScore, recency: recencyScore } };
          })
        );

        return {
          prioritized_sources: scoredSources.sort((a, b) => b.priority_score - a.priority_score),
          domain_classification: claimDomain,
          prioritization_reasoning: this.generatePrioritizationReasoning(claimDomain)
        };
    } catch (error) {
        console.error("Error in SourcePrioritizer:", error);
        if (error instanceof VerificationError) throw error;
        throw new VerificationError(`Source prioritization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parses and validates the claim domain string from the AI response.
   * @private
   */
  private parseClaimDomain(result: string): ClaimDomain {
    const domain = result.trim().toLowerCase() as ClaimDomain;
    const validDomains: ClaimDomain[] = ['political', 'scientific', 'financial', 'health', 'general'];
    return validDomains.includes(domain) ? domain : 'general';
  }

  /**
   * Uses an AI query to classify a claim into a predefined domain.
   * @private
   */
  private async classifyClaimDomain(claim: string): Promise<ClaimDomain> {
    const prompt = `Classify this claim into one of these domains: POLITICAL, SCIENTIFIC, FINANCIAL, HEALTH, GENERAL.\nClaim: "${claim}"\nRespond with only the domain name in lowercase.`;
    const result = await executeGeminiQuery(prompt);
    return this.parseClaimDomain(result);
  }

  /**
   * Calculates a base score for a source based on its category and the claim's domain weights.
   * @private
   */
  private calculateBaseScore(source: SourceItem, weights: DomainWeights): number {
    const category = source.type.category;
    return weights[category] ?? 0;
  }

  /**
   * Calculates a recency score for a source, which decays exponentially over time.
   * @private
   */
  private calculateRecencyScore(source: SourceItem): number {
    try {
      const publicationDate = new Date(source.publication_date);
      if (isNaN(publicationDate.getTime())) return 0.5; // Neutral score for invalid date
      const daysDiff = (new Date().getTime() - publicationDate.getTime()) / (1000 * 3600 * 24);
      if (daysDiff < 0) return 1; // Future date
      return Math.exp(-daysDiff / 730); // Exponential decay over 2 years
    } catch {
      return 0.5;
    }
  }

  /**
   * Uses an AI query to score the contextual relevance of a source's content to the claim.
   * @private
   */
  private async calculateContextScore(source: SourceItem, claim: string): Promise<number> {
    const prompt = `On a scale from 0.0 to 1.0, how relevant is the source content to the claim?\nClaim: "${claim}"\nSource: "${source.name}"\nContent: "${source.content.substring(0, 500)}..."\nRespond with only a single float.`;
    const result = await executeGeminiQuery(prompt);
    const score = parseFloat(result.trim());
    return isNaN(score) ? 0.5 : Math.max(0, Math.min(1, score));
  }

  /**
   * Generates a human-readable explanation for why a certain domain was prioritized.
   * @private
   */
  private generatePrioritizationReasoning(domain: ClaimDomain): string {
    const explanations: { [key in ClaimDomain]: string } = {
      political: "Political claims prioritize government sources and fact-checkers.",
      scientific: "Scientific claims prioritize peer-reviewed academic sources.",
      financial: "Financial claims rely on regulatory data and expert analysis.",
      health: "Health claims prioritize medical research and health agencies.",
      general: "General claims use a balanced approach across source types."
    };
    return explanations[domain] || explanations.general;
  }
}
