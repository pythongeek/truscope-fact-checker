import type { VerificationContext, SearchStrategy } from '../../types/verification';
import { executeGeminiQuery } from '../geminiService';
import { VerificationError } from '../../types/errorHandler';
import { isSearchStrategyArray } from './validation';

export class QueryGenerator {
  constructor() {}

  async generateSearchStrategies(
    claim: string,
    context?: VerificationContext
  ): Promise<SearchStrategy[]> {
    const prompt = this.buildPrompt(claim, context);

    try {
      const responseText = await executeGeminiQuery(prompt);

      let jsonString = responseText.trim();
      const jsonMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        jsonString = jsonMatch[1];
      }

      const strategies = JSON.parse(jsonString);

      if (!isSearchStrategyArray(strategies)) {
        throw new VerificationError('AI returned an invalid array of search strategies.');
      }

      return strategies;
    } catch (error) {
      console.error("Error in QueryGenerator:", error);
      // Re-throw the error to be handled by the orchestrator
      if (error instanceof VerificationError) {
          throw error;
      }
      throw new VerificationError(`Query generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private buildPrompt(claim: string, context?: VerificationContext): string {
    // Note: The context object is not used yet, but is here for future enhancements.
    return `
      You are an expert fact-checker creating a series of strategic search queries. For the following claim, generate 5-7 different search strategies to comprehensively verify it from multiple angles.

      Claim: "${claim}"

      For each strategy, provide the following in a JSON object:
      - search_type: A category name for the search angle. Must be one of: 'primary_source', 'academic_verification', 'news_verification', 'expert_opinion', 'historical_context', 'counter_evidence', 'recent_developments'.
      - queries: An array of 3-5 specific and diverse search query strings that an expert researcher would use.
      - target_sources: An array of strings describing the ideal sources for these queries (e.g., "Government databases", "Peer-reviewed journals", "Major news outlets").
      - verification_angle: A brief (1-sentence) explanation of what aspect of the claim this strategy aims to verify.

      Return your response as a single, valid JSON array of these strategy objects. Do not include any text, markdown formatting, or explanations outside of the JSON array.
    `;
  }
}
