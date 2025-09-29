import { GoogleFactCheckService } from './googleFactCheckService';
import { SerpApiService } from './serpApiService';
import { NewsDataService } from './newsDataService';
import { QueryExtractorService } from './queryExtractor';
import { FactCheckReport } from '@/types/factCheck';
import { getConfidenceLevel } from '../utils/scoring';

export interface ProgressUpdate {
  tier: 'direct-verification' | 'web-search' | 'specialized-analysis' | 'synthesis';
  status: 'active' | 'completed' | 'failed';
}

export type ProgressCallback = (update: ProgressUpdate) => void;

export class TieredVerificationService {
  private googleFactCheck = GoogleFactCheckService.getInstance();
  private serpApi = SerpApiService.getInstance();
  private newsData = NewsDataService.getInstance();
  private queryExtractor = QueryExtractorService.getInstance();

  async performTieredCheck(text: string, onProgress?: ProgressCallback): Promise<FactCheckReport> {
    console.log('🎯 Starting Tiered Fact Check Process');

    try {
      // Phase 1: Direct Verification (Google Fact Check API)
      onProgress?.({ tier: 'direct-verification', status: 'active' });
      const phase1Result = await this.runPhase1(text);
      onProgress?.({ tier: 'direct-verification', status: phase1Result ? 'completed' : 'failed' });

      if (phase1Result && phase1Result.confidence > 0.8) {
        console.log('✅ Phase 1 Success - High confidence result');
        onProgress?.({ tier: 'synthesis', status: 'completed' });
        return phase1Result;
      }

      // Phase 2: Broad Web Search
      onProgress?.({ tier: 'web-search', status: 'active' });
      const phase2Result = await this.runPhase2(text, phase1Result);
      onProgress?.({ tier: 'web-search', status: phase2Result !== phase1Result ? 'completed' : 'failed' });

      if (phase2Result && phase2Result.confidence > 0.7) {
        console.log('✅ Phase 2 Success - Good confidence result');
        onProgress?.({ tier: 'synthesis', status: 'completed' });
        return phase2Result;
      }

      // Phase 3: Specialized & Temporal Analysis
      onProgress?.({ tier: 'specialized-analysis', status: 'active' });
      const phase3Result = await this.runPhase3(text, phase2Result);
      onProgress?.({ tier: 'specialized-analysis', status: 'completed' });

      onProgress?.({ tier: 'synthesis', status: 'active' });
      onProgress?.({ tier: 'synthesis', status: 'completed' });
      return phase3Result;

    } catch (error) {
      console.error('❌ Tiered verification failed:', error);
      onProgress?.({ tier: 'synthesis', status: 'failed' });
      throw error;
    }
  }

  private async runPhase1(text: string): Promise<FactCheckReport | null> {
    try {
      const factCheckResults = await this.googleFactCheck.searchClaims(text, 5);

      if (factCheckResults.length === 0) {
        console.log('⏭️  No direct fact-check results found');
        return null;
      }

      // Convert Google Fact Check results to our format
      return this.convertGoogleFactCheckToReport(text, factCheckResults);
    } catch (error) {
      console.warn('Phase 1 failed:', error);
      return null;
    }
  }

  private async runPhase2(text: string, phase1Result: FactCheckReport | null): Promise<FactCheckReport | null> {
    try {
      const serpResults = await this.serpApi.search(text, 10);

      if (!serpResults.results || serpResults.results.length === 0) {
        console.warn('⚠️  No search results found');
        return phase1Result;
      }

      // Merge Phase 1 and Phase 2 results
      return this.mergeResults(text, phase1Result, serpResults);
    } catch (error) {
      console.error('Phase 2 failed:', error);
      return phase1Result;
    }
  }

  private async runPhase3(text: string, phase2Result: FactCheckReport | null): Promise<FactCheckReport> {
    try {
      // Check for temporal claims
      const hasTemporalClaims = this.detectTemporalClaims(text);

      if (hasTemporalClaims) {
        console.log('📅 Temporal elements detected, fetching recent news');
        const temporalResults = await this.fetchTemporalEvidence(text);
        return this.synthesizeFinalReport(text, phase2Result, temporalResults);
      }

      return this.synthesizeFinalReport(text, phase2Result, null);
    } catch (error) {
      console.error('⚠️  Phase 3 failed:', error);
      // Return Phase 2 result if Phase 3 fails
      return phase2Result || this.createFallbackReport(text);
    }
  }

  private detectTemporalClaims(text: string): boolean {
    const temporalPatterns = [
      /\b(today|yesterday|tomorrow|recently|currently|now)\b/i,
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}\b/i,
      /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/,
      /\b(20\d{2})\b/
    ];

    return temporalPatterns.some(pattern => pattern.test(text));
  }

  private async fetchTemporalEvidence(text: string): Promise<any> {
    try {
      const queries = await this.queryExtractor.extractSearchQueries(text);
      const newsResults = await this.newsData.searchNews(queries.primaryQuery, {
        maxResults: 10
      });
      return newsResults;
    } catch (error) {
      console.error('Temporal evidence fetch failed:', error);
      return null;
    }
  }

  private convertGoogleFactCheckToReport(text: string, results: any[]): FactCheckReport {
    // Implementation to convert Google Fact Check results to FactCheckReport format
    // This would map the Google API response to your internal report structure

    const averageRating = results.reduce((sum, r) => {
      const rating = r.claimReview[0]?.reviewRating?.ratingValue || 0;
      return sum + rating;
    }, 0) / results.length;

    return {
      id: `phase1-${Date.now()}`,
      originalText: text,
      final_verdict: this.ratingToVerdict(averageRating),
      final_score: Math.round((averageRating / 5) * 100),
      confidence: getConfidenceLevel(Math.round((averageRating / 5) * 100)),
      evidence: results.map(r => ({
        id: Math.random().toString(36).substr(2, 9),
        publisher: r.claimReview[0]?.publisher || 'Unknown',
        url: r.claimReview[0]?.url || null,
        quote: r.text,
        score: Math.round((r.claimReview[0]?.reviewRating?.ratingValue / 5) * 100),
        type: 'claim'
      })),
      score_breakdown: {
        final_score_formula: 'Google Fact Check API average',
        metrics: [{
          name: 'Direct Fact Check',
          score: Math.round((averageRating / 5) * 100),
          description: 'Based on verified fact-checking organizations'
        }]
      },
      metadata: {
        method_used: 'tiered-phase1',
        processing_time_ms: 0,
        apis_used: ['google-fact-check'],
        sources_consulted: {
          total: results.length,
          high_credibility: results.length,
          conflicting: 0
        },
        warnings: []
      },
      enhanced_claim_text: text,
      source_credibility_report: {
        overallScore: 85,
        highCredibilitySources: results.length,
        flaggedSources: 0,
        biasWarnings: [],
        credibilityBreakdown: { academic: 0, news: 0, government: 0, social: 0 }
      },
      temporal_verification: {
        hasTemporalClaims: false,
        validations: [],
        overallTemporalScore: 0,
        temporalWarnings: []
      },
      user_category_recommendations: []
    };
  }

  private ratingToVerdict(rating: number): string {
    if (rating >= 4) return 'TRUE';
    if (rating >= 3) return 'MOSTLY TRUE';
    if (rating >= 2) return 'MIXED';
    if (rating >= 1) return 'MOSTLY FALSE';
    return 'FALSE';
  }

  private mergeResults(text: string, phase1: FactCheckReport | null, serpResults: any): FactCheckReport {
    // Merge Phase 1 and SERP results
    // Implementation details here
    return phase1 || this.createFallbackReport(text);
  }

  private synthesizeFinalReport(text: string, baseReport: FactCheckReport | null, temporalData: any): FactCheckReport {
    // Synthesize all phases into final report
    return baseReport || this.createFallbackReport(text);
  }

  private createFallbackReport(text: string): FactCheckReport {
    return {
      id: `fallback-${Date.now()}`,
      originalText: text,
      final_verdict: 'UNVERIFIED',
      final_score: 50,
      confidence: getConfidenceLevel(50),
      evidence: [],
      score_breakdown: {
        final_score_formula: 'Unable to verify',
        metrics: [{
          name: 'Verification Failed',
          score: 0,
          description: 'Could not complete fact-check process'
        }]
      },
      metadata: {
        method_used: 'fallback',
        processing_time_ms: 0,
        apis_used: [],
        sources_consulted: { total: 0, high_credibility: 0, conflicting: 0 },
        warnings: ['Verification process failed. Please try again.']
      },
      enhanced_claim_text: text,
      source_credibility_report: {
        overallScore: 0,
        highCredibilitySources: 0,
        flaggedSources: 0,
        biasWarnings: [],
        credibilityBreakdown: { academic: 0, news: 0, government: 0, social: 0 }
      },
      temporal_verification: {
        hasTemporalClaims: false,
        validations: [],
        overallTemporalScore: 0,
        temporalWarnings: []
      },
      user_category_recommendations: []
    };
  }
}