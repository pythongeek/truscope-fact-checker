import type { SearchResult, VerificationContext, SourceCollection, MultiEngineSearchResult, PrioritizedSourceList, SourceItem, ClaimContext, SearchEngine } from '../../types/verification';
import { QueryGenerator } from './queryGenerator';
import { SourceAggregator } from './sourceAggregator';
import { CredibilityScorer } from './credibilityScorer';
import { SourcePrioritizer } from './sourcePrioritizer';
import { SearchEngineSimulator } from './searchEngineSimulator';
import { executeGeminiQuery } from '../geminiService';
import { VerificationErrorHandler } from './errorHandler';
import { VerificationError, ErrorHandlingContext } from '../../types/errorHandler';
import { isSynthesizedResult } from './validation';

export class SearchOrchestrator {
  private queryGenerator: QueryGenerator;
  private sourceAggregator: SourceAggregator;
  private credibilityScorer: CredibilityScorer;
  private sourcePrioritizer: SourcePrioritizer;
  private searchEngineSimulator: SearchEngineSimulator;
  private errorHandler: VerificationErrorHandler;
  private cache = new Map<string, SearchResult>();

  constructor() {
    this.queryGenerator = new QueryGenerator();
    this.sourceAggregator = new SourceAggregator();
    this.credibilityScorer = new CredibilityScorer();
    this.sourcePrioritizer = new SourcePrioritizer();
    this.searchEngineSimulator = new SearchEngineSimulator();
    this.errorHandler = new VerificationErrorHandler();
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

    let searchStrategies;
    let sources: SourceCollection = {};

    try {
      onProgress?.(10, "Generating search strategies...");
      searchStrategies = await this.queryGenerator.generateSearchStrategies(claim, context);

      onProgress?.(30, "Gathering evidence...");
      sources = await this.sourceAggregator.aggregateSourcesForClaim(claim, searchStrategies);

      onProgress?.(80, "Synthesizing verification report...");
      const finalResult = await this.synthesizeResults(claim, sources);

      this.cache.set(claim, finalResult);
      onProgress?.(100, "Verification complete");
      return finalResult;

    } catch (error) {
      const errorContext: ErrorHandlingContext = {
        operationId: `verify-${claim.replace(/\s+/g, '-')}`,
        currentProgress: 30, // Example progress
        claim: claim,
        partialResults: { sources },
      };

      const recoveryResult = await this.errorHandler.handleVerificationError(
        error as VerificationError,
        errorContext,
        onProgress
      );

      if (recoveryResult.success && recoveryResult.result) {
        // If recovery was successful, return a result indicating as much
        return {
          claim,
          isVerified: false,
          confidenceScore: 30,
          summary: recoveryResult.note || 'Verification recovered from an error, but the result may be incomplete.',
          sources: recoveryResult.result.sources || sources,
        };
      } else {
        // If recovery fails, re-throw a new error that can be caught by the UI
        throw new VerificationError(recoveryResult.warnings?.join(' ') || 'Verification process failed after recovery attempts.');
      }
    }
  }

  async simulateSearch(query: string, engines?: SearchEngine[]): Promise<MultiEngineSearchResult> {
    // This method doesn't call the AI directly, it calls the simulator which has its own error handling.
    return this.searchEngineSimulator.simulateMultiEngineSearch(query, engines);
  }

  async prioritizeSources(claim: string, sources: SourceItem[], context?: ClaimContext): Promise<PrioritizedSourceList> {
    // This method also calls a sub-service which has its own error handling.
    return this.sourcePrioritizer.prioritizeSources(claim, sources, context);
  }

  private async synthesizeResults(claim: string, sources: SourceCollection): Promise<SearchResult> {
    const prompt = this.buildSynthesizePrompt(claim, sources);

    const responseText = await executeGeminiQuery(prompt);

    let jsonString = responseText.trim();
    const jsonMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      jsonString = jsonMatch[1];
    }

    const synthesizedResult = JSON.parse(jsonString);

    if (!isSynthesizedResult(synthesizedResult)) {
        throw new VerificationError('AI returned an invalid synthesis result object.');
    }

    return {
      ...synthesizedResult,
      claim,
      sources,
    };
  }

  private buildSynthesizePrompt(claim: string, sources: SourceCollection): string {
    const evidenceString = Object.entries(sources).map(([sourceType, sourceList]) => {
        if (!sourceList || sourceList.length === 0) return '';
        const sourcesString = sourceList.map(s => `
            - Source: ${s.source_name} (${s.access_url})
              Credibility: ${s.credibility_score}/100
              Date: ${s.publication_date}
              Finding: ${s.verification_strength}
              Relevant Info: "${s.relevant_information}"
        `).join('');
        return `\n--- ${sourceType.replace('_', ' ').toUpperCase()} ---\n${sourcesString}`;
    }).join('');

    return `
      You are a senior fact-checking editor AI. Your job is to synthesize the provided evidence from multiple source types to determine the validity of a claim.

      Claim: "${claim}"

      Collected Evidence:
      ${evidenceString}

      Based *only* on the evidence provided, perform the following tasks and return the result as a single, valid JSON object:
      1. "isVerified": A boolean. True if the evidence strongly supports the claim, false if it contradicts it, and null if the evidence is mixed or inconclusive.
      2. "confidenceScore": A number from 0 to 100 indicating your confidence in the verification. This should be high if credible sources are in consensus, and low if sources are contradictory or not credible.
      3. "summary": A concise, neutral summary (2-3 sentences) explaining your conclusion. Mention the general consensus of the sources (e.g., "Most news and academic sources agree...").

      Do not use any external knowledge. Your analysis must be based solely on the provided snippets.
      Return a single, valid JSON object. Do not include any text, markdown formatting, or explanations outside of the JSON object.
    `;
  }
}
