import type { SearchEngine, MultiEngineSearchResult, EngineSearchResult, ConsensusMetrics, SimulatedSearchResult } from '../../types/verification';
import { executeGeminiQuery } from '../geminiService';
import { VerificationError } from '../../types/errorHandler';

export class SearchEngineSimulator {
  constructor() {}

  async simulateMultiEngineSearch(
    query: string,
    engines: SearchEngine[] = ['google', 'bing', 'scholarly', 'news']
  ): Promise<MultiEngineSearchResult> {

    const searchPromises = engines.map(engine =>
      this.simulateEngineSpecificSearch(query, engine)
    );

    const engineResults = await Promise.all(searchPromises);

    return {
      query,
      engines_searched: engines,
      aggregated_results: this.aggregateSearchResults(engineResults),
      result_consensus: this.calculateResultConsensus(engineResults),
      diversity_metrics: this.calculateDiversityMetrics(engineResults)
    };
  }

  private async simulateEngineSpecificSearch(
    query: string,
    engine: SearchEngine
  ): Promise<EngineSearchResult> {

    try {
      const enginePrompts = {
        google: this.buildGoogleSimulationPrompt(query),
        bing: this.buildBingSimulationPrompt(query),
        scholarly: this.buildScholarlySimulationPrompt(query),
        news: this.buildNewsSimulationPrompt(query),
        government: this.buildGovernmentSimulationPrompt(query)
      };

      const prompt = enginePrompts[engine];
      const result = await this.executeEngineQuery(prompt, engine);

      return {
        engine,
        query,
        results: result.results,
        result_count: result.results.length,
        search_quality_score: result.quality_score,
        unique_domains: this.extractUniqueDomains(result.results)
      };
    } catch (error) {
        console.error(`Error simulating search for engine ${engine}:`, error);
        if (error instanceof VerificationError) {
            throw error;
        }
        throw new VerificationError(`Search simulation failed for engine ${engine}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async executeEngineQuery(prompt: string, engine: SearchEngine): Promise<{ results: SimulatedSearchResult[], quality_score: number }> {
    // No try/catch here, let it bubble up to the caller (simulateEngineSpecificSearch)
    const responseText = await executeGeminiQuery(prompt);

    let jsonString = responseText.trim();
    const jsonMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      jsonString = jsonMatch[1];
    }

    const results = JSON.parse(jsonString);

    let quality_score = 50;
    if (results.length > 0) {
      if ('authority_score' in results[0] && typeof results[0].authority_score === 'number') {
        quality_score = results.reduce((acc: number, r: any) => acc + (r.authority_score || 0), 0) / results.length;
      } else if ('credibility_score' in results[0] && typeof results[0].credibility_score === 'number') {
        quality_score = results.reduce((acc: number, r: any) => acc + (r.credibility_score || 0), 0) / results.length;
      } else if ('citations' in results[0] && typeof results[0].citations === 'number') {
        const avgCitations = results.reduce((acc: number, r: any) => acc + (r.citations || 0), 0) / results.length;
        quality_score = Math.min(100, (avgCitations / 100) * 100);
      }
    }

    return {
      results: results as SimulatedSearchResult[],
      quality_score: Math.min(100, quality_score)
    };
  }

  private buildGoogleSimulationPrompt(query: string): string {
    return `
Simulate Google search results for: "${query}"
Provide 8-10 realistic results focusing on high-authority domains, recent content, and a mix of types.
For each result provide: title, url, domain, snippet (150-160 chars), date_published (YYYY-MM-DD), content_type ('article'/'report'/'study'/'news'/'official'), and authority_score (1-100).
Return as a valid JSON array of objects.
    `;
  }

  private buildBingSimulationPrompt(query: string): string {
    return `
Simulate Bing search results for: "${query}"
Provide 8-10 realistic results focusing on multimedia, rich snippets, and social media signals.
For each result provide: title, url, domain, snippet (150-160 chars), date_published (YYYY-MM-DD), content_type ('article'/'report'/'study'/'news'/'official'), and authority_score (1-100).
Return as a valid JSON array of objects.
    `;
  }

  private buildScholarlySimulationPrompt(query: string): string {
    return `
Simulate Google Scholar search results for: "${query}"
Provide 6-8 academic results like peer-reviewed articles and conference papers.
For each result provide: title, authors (array of strings), journal, year, citations, url, abstract_snippet, methodology ('experimental'/'survey'/'review'/'theoretical'), and peer_reviewed (boolean).
Return as a valid JSON array of objects.
    `;
  }

  private buildNewsSimulationPrompt(query: string): string {
    return `
Simulate news search results for: "${query}"
Provide 8-10 news articles from diverse, credible sources.
For each result provide: title, source, author, url, date_published (YYYY-MM-DD), article_snippet, news_category ('breaking'/'analysis'/'investigation'/'feature'), and credibility_score (1-100).
Return as a valid JSON array of objects.
    `;
  }

  private buildGovernmentSimulationPrompt(query: string): string {
    return `
Simulate a government-focused search for: "${query}"
Provide 6-8 results from official government sources.
For each result provide: title, source_agency, url, date_published (YYYY-MM-DD), document_type ('report'/'database'/'law'/'record'), summary_snippet, and authority_level ('federal'/'state'/'local').
Return as a valid JSON array of objects.
    `;
  }

  private aggregateSearchResults(engineResults: EngineSearchResult[]): SimulatedSearchResult[] {
    const allResults = engineResults.flatMap(er => er.results);
    const uniqueResults = Array.from(new Map(allResults.map(r => [r.url, r])).values());
    return uniqueResults;
  }

  private extractUniqueDomains(results: SimulatedSearchResult[]): string[] {
    const domains = results.map(r => {
      try {
        if ('domain' in r && r.domain) return r.domain;
        return new URL(r.url).hostname;
      } catch {
        return '';
      }
    }).filter(d => d);
    return [...new Set(domains)];
  }

  private calculateDomainOverlap(results: EngineSearchResult[]): number {
    if (results.length < 2) return 1;
    const domainSets = results.map(r => new Set(r.unique_domains));
    const intersection = domainSets.reduce((a, b) => new Set([...a].filter(x => b.has(x))));
    const union = new Set(domainSets.flatMap(s => [...s]));
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private calculateContentSimilarity(results: EngineSearchResult[]): number {
    if (results.length < 2) return 1;
    const allUrls = results.flatMap(r => r.results.map(res => res.url));
    const uniqueUrls = new Set(allUrls);
    const overlap = allUrls.length - uniqueUrls.size;
    const maxPossibleOverlap = allUrls.length > results.length ? allUrls.length - results.length : 0;
    return maxPossibleOverlap > 0 ? overlap / maxPossibleOverlap : 0;
  }

  private calculateAuthorityConsistency(results: EngineSearchResult[]): number {
    const scores = results.map(r => r.search_quality_score).filter(s => s > 0);
    if (scores.length < 2) return 1;
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const stdDev = Math.sqrt(scores.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / scores.length);
    const consistency = 1 - (stdDev / 50);
    return Math.max(0, Math.min(1, consistency));
  }

  private calculateResultConsensus(results: EngineSearchResult[]): ConsensusMetrics {
    const domainOverlap = this.calculateDomainOverlap(results);
    const contentSimilarity = this.calculateContentSimilarity(results);
    const authorityConsistency = this.calculateAuthorityConsistency(results);

    return {
      domain_consensus: domainOverlap,
      content_consensus: contentSimilarity,
      authority_consensus: authorityConsistency,
      overall_consensus: (domainOverlap + contentSimilarity + authorityConsistency) / 3
    };
  }

  private calculateDiversityMetrics(engineResults: EngineSearchResult[]): any {
    const allResults = this.aggregateSearchResults(engineResults);
    const uniqueDomains = this.extractUniqueDomains(allResults);
    const contentTypes = allResults.map(r => ('content_type' in r && r.content_type) ? r.content_type : 'other');
    const contentTypeDistribution = contentTypes.reduce((acc: any, ct) => {
      acc[ct] = (acc[ct] || 0) + 1;
      return acc;
    }, {});

    return {
      unique_domain_count: uniqueDomains.length,
      content_type_distribution: contentTypeDistribution,
      domain_entropy: this.calculateEntropy(uniqueDomains),
    };
  }

  private calculateEntropy(items: string[]): number {
    const n = items.length;
    if (n === 0) return 0;
    const counts = items.reduce((acc: any, item) => {
      acc[item] = (acc[item] || 0) + 1;
      return acc;
    }, {});

    let entropy = 0;
    for (const key in counts) {
      const p = counts[key] / n;
      entropy -= p * Math.log2(p);
    }
    return entropy;
  }
}
