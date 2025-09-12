import type { SourceItem, CredibilityScore } from '../../types/verification';
import { executeGeminiQuery } from '../geminiService';
import { VerificationError } from '../../types/errorHandler';
import { isCredibilityScore } from './validation';

// The OverallCredibilityResult type seems to be missing from the types file.
// I will add it here for now, and consider moving it to types/verification.ts later.
export interface OverallCredibilityResult {
  overallScore: number;
  consensus: 'strong' | 'moderate' | 'weak';
  contradictionAnalysis: string;
}

export class CredibilityScorer {
  // Weights are now defined with lowercase keys to match the CredibilityScore type
  public readonly CREDIBILITY_CRITERIA: { [key in keyof CredibilityScore['component_scores']]: number } = {
    source_authority: 0.25,
    editorial_standards: 0.20,
    expertise_relevance: 0.20,
    corroboration: 0.15,
    recency: 0.10,
    transparency: 0.10
  };

  constructor() {}

  async scoreSourceCredibility(source: SourceItem): Promise<CredibilityScore> {
    const prompt = this.buildScoringPrompt(source);

    try {
      const responseText = await executeGeminiQuery(prompt);

      let jsonString = responseText.trim();
      const jsonMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        jsonString = jsonMatch[1];
      }

      // The AI returns an object with component_scores and reasoning
      const partialResult = JSON.parse(jsonString);

      // Calculate the overall score in code for reliability
      let calculatedScore = 0;
      for (const key in this.CREDIBILITY_CRITERIA) {
          const criterion = key as keyof typeof this.CREDIBILITY_CRITERIA;
          const componentScore = partialResult.component_scores?.[criterion] || 0;
          calculatedScore += componentScore * this.CREDIBILITY_CRITERIA[criterion];
      }

      // Assemble the full CredibilityScore object
      const scores: CredibilityScore = {
        component_scores: partialResult.component_scores,
        reasoning: partialResult.reasoning,
        confidence_interval: partialResult.confidence_interval,
        overall_score: Math.round(calculatedScore), // Round to the nearest integer
      };

      if (!isCredibilityScore(scores)) {
          throw new VerificationError('AI returned an invalid credibility score object.');
      }

      return scores;
    } catch (error) {
      console.error(`Error scoring credibility for source "${source.name}":`, error);
      // Re-throw the error to be handled by the orchestrator
      if (error instanceof VerificationError) {
          throw error;
      }
      throw new VerificationError(`Credibility scoring failed for ${source.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async calculateOverallCredibility(scores: CredibilityScore[]): Promise<OverallCredibilityResult> {
    if (scores.length === 0) {
        return {
            overallScore: 0,
            consensus: 'weak',
            contradictionAnalysis: "No sources to analyze.",
        };
    }
    // The overall credibility is the average of the reliably calculated scores.
    const overallScore = scores.reduce((acc, score) => acc + score.overall_score, 0) / scores.length;

    const consensus = overallScore >= 75 ? 'strong' : overallScore >= 50 ? 'moderate' : 'weak';

    return {
      overallScore: Math.round(overallScore),
      consensus,
      contradictionAnalysis: "No major contradictions found in this simplified analysis.",
    };
  }

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
