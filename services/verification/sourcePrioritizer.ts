// AI CODING INSTRUCTION: Create a sophisticated source prioritization system
// that dynamically ranks sources based on claim type, topic, and context

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { SourceItem, ClaimContext, PrioritizedSourceList, ClaimDomain, DomainWeights } from '../../types/verification';

export class SourcePrioritizer {
  private geminiClient: GoogleGenerativeAI;

  constructor(geminiClient: GoogleGenerativeAI) {
    this.geminiClient = geminiClient;
  }

  private readonly DOMAIN_WEIGHTS: { [key in ClaimDomain]: DomainWeights } = {
    political: {
      government: 0.35,
      factcheck: 0.25,
      news: 0.20,
      academic: 0.15,
      expert: 0.05,
      industry: 0.0
    },
    scientific: {
      academic: 0.40,
      government: 0.25,
      expert: 0.20,
      news: 0.10,
      factcheck: 0.05,
      industry: 0.0
    },
    financial: {
      government: 0.30,
      expert: 0.25,
      news: 0.20,
      academic: 0.15,
      factcheck: 0.10,
      industry: 0.1
    },
    health: {
      academic: 0.35,
      government: 0.30,
      expert: 0.20,
      news: 0.10,
      factcheck: 0.05,
      industry: 0.0
    },
    general: {
      factcheck: 0.25,
      news: 0.20,
      government: 0.20,
      academic: 0.20,
      expert: 0.15,
      industry: 0.0
    }
  };

  async prioritizeSources(
    claim: string,
    availableSources: SourceItem[],
    claimContext?: ClaimContext
  ): Promise<PrioritizedSourceList> {

    // Determine claim domain using AI analysis
    const claimDomain = await this.classifyClaimDomain(claim);

    // Get domain-specific weights
    const weights = this.DOMAIN_WEIGHTS[claimDomain] || this.DOMAIN_WEIGHTS.general;

    // Score and rank sources
    const scoredSources = await Promise.all(
      availableSources.map(async source => {
        const baseScore = this.calculateBaseScore(source, weights);
        const contextScore = await this.calculateContextScore(source, claim, claimContext);
        const recencyScore = this.calculateRecencyScore(source);

        const finalScore = (baseScore * 0.6) + (contextScore * 0.3) + (recencyScore * 0.1);

        return {
          source,
          priority_score: finalScore,
          ranking_factors: {
            domain_relevance: baseScore,
            context_relevance: contextScore,
            recency: recencyScore
          }
        };
      })
    );

    return {
      prioritized_sources: scoredSources.sort((a, b) => b.priority_score - a.priority_score),
      domain_classification: claimDomain,
      prioritization_reasoning: this.generatePrioritizationReasoning(claimDomain, this.DOMAIN_WEIGHTS[claimDomain])
    };
  }

  private async executeClassificationQuery(prompt: string): Promise<string> {
    const model = this.geminiClient.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    return result.response.text();
  }

  private parseClaimDomain(result: string): ClaimDomain {
    const domain = result.trim().toLowerCase() as ClaimDomain;
    const validDomains: ClaimDomain[] = ['political', 'scientific', 'financial', 'health', 'general'];
    if (validDomains.includes(domain)) {
      return domain;
    }
    return 'general'; // Default to general if parsing fails
  }

  private async classifyClaimDomain(claim: string): Promise<ClaimDomain> {
    const prompt = `
Classify this claim into one of these domains based on its primary subject matter:

POLITICAL: Government actions, elections, policy, politicians, legislation
SCIENTIFIC: Research findings, medical studies, environmental data, technology
FINANCIAL: Economics, business performance, market data, financial regulations
HEALTH: Medical advice, drug efficacy, health statistics, disease information
GENERAL: All other claims not fitting the above categories

Claim: "${claim}"

Respond with just the domain name in lowercase.
    `;

    const result = await this.executeClassificationQuery(prompt);
    return this.parseClaimDomain(result);
  }

  private calculateBaseScore(source: SourceItem, weights: DomainWeights): number {
    return weights[source.type.category] || 0;
  }

  private calculateRecencyScore(source: SourceItem): number {
    try {
      const publicationDate = new Date(source.publication_date);
      if (isNaN(publicationDate.getTime())) {
        return 0.5; // Invalid date format
      }
      const today = new Date();
      const timeDiff = today.getTime() - publicationDate.getTime();
      const daysDiff = timeDiff / (1000 * 3600 * 24);

      if (daysDiff < 0) return 1; // Future date

      // Score decays over 2 years
      const score = Math.exp(-daysDiff / 730);
      return score;
    } catch (error) {
      return 0.5; // Neutral score if date is invalid
    }
  }

  private async calculateContextScore(source: SourceItem, claim: string, claimContext?: ClaimContext): Promise<number> {
    const prompt = `
On a scale from 0.0 to 1.0, how relevant is the following source content to the claim?
Consider if the source directly addresses the key points of the claim.
Respond with only a single floating-point number.

Claim: "${claim}"

Source Name: "${source.name}"
Source Content:
---
${source.content.substring(0, 2000)}
---

Relevance Score (0.0-1.0):
    `;
    try {
      const result = await this.executeClassificationQuery(prompt);
      const score = parseFloat(result.trim());
      return isNaN(score) ? 0.5 : Math.max(0, Math.min(1, score));
    } catch (error) {
      return 0.5; // Neutral score on error
    }
  }

  private generatePrioritizationReasoning(
    domain: ClaimDomain,
    weights: DomainWeights
  ): string {
    const explanations: { [key in ClaimDomain]: string } = {
      political: "For political claims, government sources and established fact-checkers are prioritized for accuracy and non-partisanship.",
      scientific: "Scientific claims prioritize peer-reviewed academic sources and authoritative government research agencies.",
      financial: "Financial claims rely heavily on government regulatory data and expert analysis from financial professionals.",
      health: "Health claims prioritize medical research and government health agencies due to safety implications.",
      general: "General claims use a balanced approach across all source types with slight preference for dedicated fact-checkers."
    };

    return explanations[domain] || explanations.general;
  }
}
