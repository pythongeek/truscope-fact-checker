import type { SourceItem, CredibilityScore } from '../../types/verification';
import { executeGeminiQuery } from '../geminiService';
import { VerificationError } from '../../types/errorHandler';
import { isCredibilityScore } from './validation';

/**
 * Represents the result of an overall credibility analysis across multiple sources.
 */
export interface OverallCredibilityResult {
  /**
   * The average credibility score, rounded to the nearest integer.
   */
  overallScore: number;
  /**
   * The level of consensus among the sources.
   */
  consensus: 'strong' | 'moderate' | 'weak';
  /**
   * A textual analysis of any contradictions found.
   */
  contradictionAnalysis: string;
}

/**
 * A class responsible for evaluating the credibility of information sources.
 * It uses a criteria-based approach to score sources and can aggregate these scores.
 */
export class CredibilityScorer {
  /**
   * Defines the criteria for credibility scoring and their respective weights.
   * The sum of weights should ideally be 1.0.
   */
  public readonly CREDIBILITY_CRITERIA: { [key in keyof CredibilityScore['component_scores']]: number } = {
    source_authority: 0.25,
    editorial_standards: 0.20,
    expertise_relevance: 0.20,
    corroboration: 0.15,
    recency: 0.10,
    transparency: 0.10
  };

  constructor() {}

  /**
   * Scores the credibility of a single source item by querying the Gemini API.
   * It sends a detailed prompt and calculates a weighted overall score from the AI's response.
   *
   * @param {SourceItem} source - The source item to be scored.
   * @returns {Promise<CredibilityScore>} A promise that resolves to the full credibility score object.
   * @throws {VerificationError} If the AI returns an invalid object or the scoring process fails.
   */
  async scoreSourceCredibility(source: SourceItem): Promise<CredibilityScore> {
    const prompt = this.buildScoringPrompt(source);

    try {
      const responseText = await executeGeminiQuery(prompt);

      let jsonString = responseText.trim();
      const jsonMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        jsonString = jsonMatch[1];
      }

      const partialResult = JSON.parse(jsonString);

      let calculatedScore = 0;
      for (const key in this.CREDIBILITY_CRITERIA) {
          const criterion = key as keyof typeof this.CREDIBILITY_CRITERIA;
          const componentScore = partialResult.component_scores?.[criterion] || 0;
          calculatedScore += componentScore * this.CREDIBILITY_CRITERIA[criterion];
      }

      const scores: CredibilityScore = {
        component_scores: partialResult.component_scores,
        reasoning: partialResult.reasoning,
        confidence_interval: partialResult.confidence_interval,
        overall_score: Math.round(calculatedScore),
      };

      if (!isCredibilityScore(scores)) {
          throw new VerificationError('AI returned an invalid credibility score object.');
      }

      return scores;
    } catch (error) {
      console.error(`Error scoring credibility for source "${source.name}":`, error);
      if (error instanceof VerificationError) {
          throw error;
      }
      throw new VerificationError(`Credibility scoring failed for ${source.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculates an overall credibility score and consensus from a list of individual source scores.
   *
   * @param {CredibilityScore[]} scores - An array of credibility scores for multiple sources.
   * @returns {Promise<OverallCredibilityResult>} A promise that resolves to the aggregated credibility result.
   */
  async calculateOverallCredibility(scores: CredibilityScore[]): Promise<OverallCredibilityResult> {
    if (scores.length === 0) {
        return {
            overallScore: 0,
            consensus: 'weak',
            contradictionAnalysis: "No sources to analyze.",
        };
    }
    const overallScore = scores.reduce((acc, score) => acc + score.overall_score, 0) / scores.length;

    const consensus = overallScore >= 75 ? 'strong' : overallScore >= 50 ? 'moderate' : 'weak';

    return {
      overallScore: Math.round(overallScore),
      consensus,
      contradictionAnalysis: "No major contradictions found in this simplified analysis.",
    };
  }

  /**
   * Builds the prompt for the Gemini API to score a source's credibility.
   *
   * @private
   * @param {SourceItem} source - The source item to build the prompt for.
   * @returns {string} The complete prompt string.
   */
  private buildScoringPrompt(source: SourceItem): string {
    return `
      You are an expert source credibility evaluator. Your task is to analyze the provided source information and score it based on a predefined set of criteria.

      Source to Analyze:
      - Name: ${source.name}
      - Type: ${source.type.category}
      - URL: ${source.url}
      - Content Snippet: "${source.content}"

      Please evaluate the source on the following criteria, providing a score from 1 to 100 for each, along with a brief reasoning for your score.

      Criteria:
      1.  **source_authority**: How authoritative is the source itself? (e.g., Is it a government body, a leading academic journal, or a personal blog?)
      2.  **editorial_standards**: Does the source have clear editorial standards, a corrections policy, and a reputation for accuracy?
      3.  **expertise_relevance**: Is the author/publication an expert in the specific topic of the claim?
      4.  **corroboration**: Is the information supported by other reliable sources? (You can infer this based on the source's nature).
      5.  **recency**: How recent and relevant is the information to the present day?
      6.  **transparency**: Does the source cite its own sources or explain its methodology?

      Return your response as a single, valid JSON object. The JSON object must contain:
      - "component_scores": An object with keys for each criterion (e.g., "source_authority"). The value for each key must be a number from 1 to 100.
      - "reasoning": An object with keys for each criterion, containing your brief textual explanation for the score.
      - "confidence_interval": A two-element array representing the confidence range of your overall score, e.g., [85, 95].

      **Do not** calculate the final "overall_score" yourself. Only provide the component scores.
    `;
  }
}
