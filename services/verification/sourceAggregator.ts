import { GoogleGenerativeAI } from "@google/generative-ai";
import type { EvidenceItem, SearchStrategy } from '../../types/verification';

export class SourceAggregator {
  constructor(private geminiClient: GoogleGenerativeAI) {}

  async gatherEvidenceForStrategy(strategy: SearchStrategy): Promise<EvidenceItem[]> {
    const prompt = this.buildPrompt(strategy);
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

      const evidence = JSON.parse(jsonString);
      // TODO: Add validation for the parsed evidence
      return evidence.map((item: any) => ({ ...item, strategy }));
    } catch (error) {
      console.error(`Error gathering evidence for strategy "${strategy.query}":`, error);
      return [];
    }
  }

  private buildPrompt(strategy: SearchStrategy): string {
    return `
      You are an AI search simulation engine. Your task is to act as the search engine "${strategy.engine}" and generate a realistic set of search results for the query: "${strategy.query}".

      Prioritize sources of type: "${strategy.sourceType}".

      Generate a JSON array of 3-5 search result objects. Each object should include:
      1. "title": A realistic and relevant title for a search result link.
      2. "url": A plausible, representative URL (e.g., "https://www.example.com/article/123").
      3. "snippet": A descriptive snippet (1-2 sentences) that accurately summarizes the content of the hypothetical source and is relevant to the search query.

      Example for query "Eiffel Tower construction material" and sourceType "general":
      [
        {
          "title": "Eiffel Tower - Wikipedia",
          "url": "https://en.wikipedia.org/wiki/Eiffel_Tower",
          "snippet": "The Eiffel Tower is a wrought-iron lattice tower on the Champ de Mars in Paris, France. It is named after the engineer Gustave Eiffel, whose company designed and built the tower."
        },
        {
          "title": "The Construction of the Eiffel Tower - History.com",
          "url": "https://www.history.com/topics/landmarks/eiffel-tower",
          "snippet": "Learn about the design and construction of the Eiffel Tower, one of the world's most famous landmarks. The tower is composed of wrought iron, a type of iron with a very low carbon content."
        },
        {
          "title": "Official Site of the Eiffel Tower: The Monument",
          "url": "https://www.toureiffel.paris/en/the-monument",
          "snippet": "Discover the history of the Eiffel Tower, from its construction for the 1889 World's Fair to its current status as a global icon. The structure is made of 7,300 tonnes of wrought iron."
        }
      ]

      Now, generate the JSON for the query: "${strategy.query}"
    `;
  }
}
