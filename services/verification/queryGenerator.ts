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
          query: claim,
          engine: 'Google',
          sourceType: 'general',
        },
      ];
    }
  }

  private buildPrompt(claim: string, context?: VerificationContext): string {
    return `
      You are a world-class investigative journalist AI. Your task is to generate a diverse set of search strategies to verify the following claim: "${claim}"

      Consider the following context if provided:
      - Topic: ${context?.topic || 'Not specified'}
      - Preferred Source Type: ${context?.sourceType || 'Any'}

      Generate a JSON array of 5-7 distinct search strategies. Each strategy object should include:
      1. "query": A concise, effective search query (e.g., using keywords, direct quotes, or questions).
      2. "engine": The simulated search engine to use ('Google', 'Bing', 'DuckDuckGo').
      3. "sourceType": The type of source to prioritize ('general', 'news', 'academic', 'forum').

      Vary the strategies by:
      - Using different query formulations (e.g., keyword-based, question-based, site-specific).
      - Targeting different source types to gather a range of perspectives.
      - Combining keywords from the claim in different ways.

      Example output for the claim "The Eiffel Tower is made of cheese":
      [
        { "query": "Eiffel Tower construction material", "engine": "Google", "sourceType": "general" },
        { "query": "is the Eiffel Tower made of cheese fact check", "engine": "DuckDuckGo", "sourceType": "general" },
        { "query": "Eiffel Tower official website materials", "engine": "Google", "sourceType": "news" },
        { "query": "scientific analysis of Eiffel Tower composition", "engine": "Google", "sourceType": "academic" },
        { "query": "discussion about Eiffel Tower materials forum", "engine": "Bing", "sourceType": "forum" }
      ]

      Now, generate the JSON for the claim: "${claim}"
    `;
  }
}
