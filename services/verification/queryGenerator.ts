import { GoogleGenerativeAI } from "@google/generative-ai";
import type { VerificationContext, SearchStrategy } from '../../types/verification';

export class QueryGenerator {
  constructor(private geminiClient: GoogleGenerativeAI) {}

  async generateSearchStrategies(
    claim: string,
    context?: VerificationContext
  ): Promise<SearchStrategy[]> {
    const prompt = this.buildPrompt(claim, context);
    const model = this.geminiClient.getGenerativeModel({ model: "gemini-1.5-flash" });

    try {
      const result = await model.generateContent(prompt);
      const response = result.response;
      const responseText = response.text();

      let jsonString = responseText.trim();
      const jsonMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        jsonString = jsonMatch[1];
      }

      const strategies = JSON.parse(jsonString);
      // TODO: Add validation for the parsed strategies
      return strategies;
    } catch (error) {
      console.error("Error generating search strategies:", error);
      // Fallback to a default strategy
      return [
        {
          search_type: 'news',
          queries: [claim],
          target_sources: ['reputable news organizations'],
          verification_angle: 'General verification of the claim.'
        }
      ];
    }
  }

  private buildPrompt(claim: string, context?: VerificationContext): string {
    return `
      You are an expert fact-checker creating search strategies. For the claim "${claim}", generate 5-7 different search approaches:

      1. PRIMARY SOURCE SEARCH: Queries to find original documents, official statements, raw data
      2. ACADEMIC VERIFICATION: Scholarly articles, research papers, peer-reviewed studies
      3. NEWS VERIFICATION: Reputable journalism, fact-checking organizations
      4. EXPERT OPINION: Subject matter expert perspectives, professional analysis
      5. HISTORICAL CONTEXT: Background information, related events, trends
      6. COUNTER-EVIDENCE: Opposing viewpoints, contradictory information
      7. RECENT DEVELOPMENTS: Latest updates, current status

      For each strategy, provide:
      - search_type: (primary/academic/news/expert/historical/counter/recent)
      - queries: [array of 3-5 specific search terms]
      - target_sources: [types of sources to prioritize]
      - verification_angle: (what aspect this strategy verifies)

      Return as JSON array of SearchStrategy objects.
    `;
  }
}
