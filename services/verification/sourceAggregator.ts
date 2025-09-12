import { GoogleGenerativeAI } from "@google/generative-ai";
import type { SourceCollection, SearchStrategy } from '../../types/verification';

export class SourceAggregator {
  constructor(private geminiClient: GoogleGenerativeAI) {}

  async aggregateSourcesForClaim(
    claim: string,
    strategies: SearchStrategy[]
  ): Promise<SourceCollection> {

    const prompt = this.buildPrompt(claim, strategies);
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

      const sources = JSON.parse(jsonString);
      // TODO: Add validation for the parsed sources
      return sources;
    } catch (error) {
      console.error("Error aggregating sources:", error);
      return {
        primary_sources: [],
        news_sources: [],
        fact_checking_sources: [],
        expert_sources: [],
      };
    }
  }

  private buildPrompt(claim: string, strategies: SearchStrategy[]): string {
    const strategiesString = strategies.map(s => `- ${s.search_type}: ${s.queries.join(', ')}`).join('\n');

    return `
      You are simulating access to comprehensive information sources for fact-checking.
      For the claim: "${claim}"

      Using your training knowledge and the following search strategies:
      ${strategiesString}

      Provide detailed information as if you searched:

      PRIMARY SOURCES:
      - Government databases (.gov sites, regulatory filings, official reports)
      - Academic repositories (PubMed, arXiv, institutional databases)
      - Legal documents (court records, legislation, regulatory text)
      - Corporate filings (SEC, earnings reports, official statements)

      NEWS SOURCES:
      - Associated Press, Reuters (wire service accuracy)
      - Major newspapers (NYT, WSJ, Washington Post, Guardian)
      - Broadcast networks (BBC, NPR, PBS NewsHour)
      - Specialized outlets (Politico, ProPublica for investigative)

      FACT-CHECKING SOURCES:
      - PolitiFact, FactCheck.org, Snopes
      - International fact-checkers (AFP Fact Check, BBC Reality Check)
      - Academic fact-checking (Duke Reporters' Lab, Poynter)

      EXPERT SOURCES:
      - University researchers and professors
      - Think tank analysts and reports
      - Industry professionals and trade publications
      - Scientific societies and professional organizations

      For each source type, provide:
      - source_name: "Authoritative source name"
      - source_type: "government/academic/news/factcheck/expert"
      - credibility_score: 1-100 based on source reputation
      - relevant_information: "Key facts supporting or contradicting the claim"
      - publication_date: "When this information was published/updated"
      - access_url: "Realistic URL where this would be found"
      - verification_strength: "strong_support/weak_support/neutral/weak_contradiction/strong_contradiction"

      Return comprehensive results as JSON in a SourceCollection object.
    `;
  }
}
