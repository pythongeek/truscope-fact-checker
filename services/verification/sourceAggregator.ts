import type { SourceCollection, SearchStrategy } from '../../types/verification';
import { executeGeminiQuery } from '../geminiService';
import { VerificationError } from '../../types/errorHandler';
import { isSourceCollection } from './validation';

/**
 * A class responsible for generating a collection of simulated source information
 * based on a claim and a set of search strategies.
 */
export class SourceAggregator {
  constructor() {}

  /**
   * Generates a collection of simulated sources for a given claim using the Gemini API.
   * It constructs a detailed prompt asking the AI to simulate finding various types of
   * sources (primary, academic, news, etc.) relevant to the claim.
   *
   * @param {string} claim - The claim to aggregate sources for.
   * @param {SearchStrategy[]} strategies - The search strategies to guide the source generation.
   * @returns {Promise<SourceCollection>} A promise that resolves to a collection of categorized source items.
   * @throws {VerificationError} If the AI returns an invalid response or the query fails.
   */
  async aggregateSourcesForClaim(
    claim: string,
    strategies: SearchStrategy[]
  ): Promise<SourceCollection> {
    const prompt = this.buildPrompt(claim, strategies);

    try {
      const responseText = await executeGeminiQuery(prompt);

      let jsonString = responseText.trim();
      const jsonMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        jsonString = jsonMatch[1];
      }

      const sources = JSON.parse(jsonString);

      if (!isSourceCollection(sources)) {
        throw new VerificationError('AI returned an invalid source collection object.');
      }

      return sources;
    } catch (error) {
      console.error("Error in SourceAggregator:", error);
      if (error instanceof VerificationError) {
          throw error;
      }
      throw new VerificationError(`Source aggregation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Builds the prompt for the Gemini API to generate a collection of simulated sources.
   *
   * @private
   * @param {string} claim - The claim to build the prompt for.
   * @param {SearchStrategy[]} strategies - The search strategies to include in the prompt.
   * @returns {string} The complete prompt string.
   */
  private buildPrompt(claim: string, strategies: SearchStrategy[]): string {
    const strategiesString = strategies.map(s => `- ${s.search_type}: ${s.queries.join(', ')}`).join('\n');

    return `
      You are a simulation AI that provides realistic, synthesized source information for fact-checking purposes. Based on your training data, you will generate plausible source snippets that would be found when researching a claim.

      Claim: "${claim}"

      Based on the claim and the following search strategies, generate a collection of simulated source information.
      Search Strategies:
      ${strategiesString}

      For each of the following categories, provide 2-3 detailed, distinct, and realistic source entries. The content should be neutral and encyclopedic, reflecting what one would find in a real-world search.

      The JSON object you return should have keys for: "primary_sources", "academic_sources", "news_sources", and "expert_sources". Each key should correspond to an array of source objects. Each source object must have the following properties:
      - source_name: The name of the publication, institution, or document (e.g., "U.S. Bureau of Labor Statistics", "The New England Journal of Medicine", "Reuters").
      - access_url: A realistic, plausible URL for the source.
      - credibility_score: A number from 1 to 100, representing the general credibility of the source type.
      - publication_date: A realistic date for the information, in YYYY-MM-DD format.
      - verification_strength: A string, one of 'strong_support', 'weak_support', 'neutral', 'weak_contradiction', 'strong_contradiction'.
      - relevant_information: A 2-4 sentence detailed snippet of information relevant to the claim, written in a style appropriate for the source.

      Return a single, valid JSON object. Do not include any text, markdown formatting, or explanations outside of the JSON object.
    `;
  }
}
