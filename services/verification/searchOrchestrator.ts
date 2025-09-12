import { GoogleGenerativeAI } from "@google/generative-ai";
import type { SearchResult, VerificationContext, SourceCollection, MultiEngineSearchResult, PrioritizedSourceList, SourceItem, ClaimContext, SearchEngine } from '../../types/verification';
import { QueryGenerator } from './queryGenerator';
import { SourceAggregator } from './sourceAggregator';
import { CredibilityScorer } from './credibilityScorer';
import { SourcePrioritizer } from './sourcePrioritizer';
import { SearchEngineSimulator } from './searchEngineSimulator';

export class SearchOrchestrator {
  private queryGenerator: QueryGenerator;
  private sourceAggregator: SourceAggregator;
  private credibilityScorer: CredibilityScorer;
  private sourcePrioritizer: SourcePrioritizer;
  private searchEngineSimulator: SearchEngineSimulator;
  private cache = new Map<string, SearchResult>();

  constructor(private geminiClient: GoogleGenerativeAI) {
    this.queryGenerator = new QueryGenerator(geminiClient);
    this.sourceAggregator = new SourceAggregator(geminiClient);
    this.credibilityScorer = new CredibilityScorer(geminiClient);
    this.sourcePrioritizer = new SourcePrioritizer(geminiClient);
    this.searchEngineSimulator = new SearchEngineSimulator(geminiClient);
  }

  async verifyClaimWithSources(
    claim: string,
    context?: VerificationContext,
    onProgress?: (progress: number, status: string) => void
  ): Promise<SearchResult> {
    const cachedResult = this.cache.get(claim);
    if (cachedResult) {
      onProgress?.(100, "Retrieved from cache");
      return cachedResult;
    }

    onProgress?.(10, "Generating search strategies...");
    const searchStrategies = await this.queryGenerator.generateSearchStrategies(claim, context);

    onProgress?.(30, "Gathering evidence from knowledge base...");
    const sources = await this.sourceAggregator.aggregateSourcesForClaim(claim, searchStrategies);

    onProgress?.(80, "Synthesizing verification report...");
    const finalResult = await this.synthesizeResults(claim, sources);

    this.cache.set(claim, finalResult);
    onProgress?.(100, "Verification complete");

    return finalResult;
  }

  async simulateSearch(query: string, engines?: SearchEngine[]): Promise<MultiEngineSearchResult> {
    return this.searchEngineSimulator.simulateMultiEngineSearch(query, engines);
  }

  async prioritizeSources(claim: string, sources: SourceItem[], context?: ClaimContext): Promise<PrioritizedSourceList> {
    return this.sourcePrioritizer.prioritizeSources(claim, sources, context);
  }

  private async synthesizeResults(claim: string, sources: SourceCollection): Promise<SearchResult> {
    const prompt = this.buildSynthesizePrompt(claim, sources);
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

      const synthesizedResult = JSON.parse(jsonString);
      // TODO: Add validation
      return {
        ...synthesizedResult,
        claim,
        sources,
      };
    } catch (error) {
      console.error("Error synthesizing results:", error);
      return {
        claim,
        isVerified: false,
        confidenceScore: 0,
        summary: "Error synthesizing results.",
        sources,
      };
    }
  }

  private buildSynthesizePrompt(claim: string, sources: SourceCollection): string {
    const evidenceString = Object.entries(sources).map(([sourceType, sourceList]) => {
        if (sourceList.length === 0) return '';
        const sourcesString = sourceList.map(s => `
            Source: ${s.source_name} (${s.access_url})
            Credibility: ${s.credibility_score}/100
            Publication Date: ${s.publication_date}
            Verification: ${s.verification_strength}
            Relevant Info: ${s.relevant_information}
        `).join('');
        return `\n--- ${sourceType.replace('_', ' ').toUpperCase()} ---\n${sourcesString}`;
    }).join('');

    return `
      You are a senior fact-checking editor AI. Your job is to synthesize the provided evidence from multiple source types to verify a claim.

      Claim to verify: "${claim}"

      Collected Evidence:
      ${evidenceString}

      Based *only* on the evidence provided, perform the following tasks and return the result as a single JSON object:
      1. "isVerified": A boolean indicating if the claim is supported by the evidence.
      2. "confidenceScore": A number from 0 to 100 indicating the confidence in your verification.
      3. "summary": A concise, neutral summary (2-3 sentences) explaining your conclusion based on the evidence.

      Do not use any external knowledge. Your analysis must be based solely on the provided snippets.

      Example output:
      {
        "isVerified": true,
        "confidenceScore": 95,
        "summary": "The evidence from multiple credible sources (Wikipedia, History.com, and the official site) consistently states that the Eiffel Tower is made of wrought iron, not cheese. The claim is therefore false."
      }

      Now, generate the JSON for the claim: "${claim}"
    `;
  }
}
