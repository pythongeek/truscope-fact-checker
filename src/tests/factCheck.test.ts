import { describe, test, expect, vi } from 'vitest';
import { EnhancedFactCheckService } from '../services/enhancedFactCheckService';
import { getMethodCapabilities } from '../services/methodCapabilities';

// Mock the new class-based services
vi.mock('../services/factCheckSearchService', () => {
    const FactCheckSearchService = {
        getInstance: vi.fn().mockReturnValue({
            runPhase2WebSearch: vi.fn().mockResolvedValue({
                serpResults: [{ link: 'http://serp.com/result', snippet: 'SERP snippet', source: 'serp.com' }],
                googleGroundingResults: [{ link: 'http://google.com/result', snippet: 'Google snippet', source: 'google.com' }],
                aiOverview: 'This is a mocked AI overview.',
            }),
        }),
    };
    return { FactCheckSearchService };
});

vi.mock('../services/newsDataService', () => {
    const NewsDataService = {
        getInstance: vi.fn().mockReturnValue({
            runPhase3TemporalAnalysis: vi.fn().mockResolvedValue({
                results: [{ title: 'Mocked News Article', snippet: 'Content from mocked news.' }],
            }),
            // Keep existing methods for other tests if necessary
            searchTemporalNews: vi.fn(),
            searchNews: vi.fn(),
        }),
    };
    return { NewsDataService };
});

// Mock dependent services to isolate the test to the orchestration logic
vi.mock('../services/analysis/CitationAugmentedService', () => {
  return {
    CitationAugmentedService: vi.fn().mockImplementation(() => {
      return {
        // Mock for the 'comprehensive' analysis path
        processSearchResults: vi.fn().mockResolvedValue({
          id: 'base-report-comprehensive',
          originalText: 'Test claim from 2024',
          final_score: 75,
          final_verdict: 'Base analysis verdict',
          evidence: [{ id: 'e1', url: 'http://example.com/source1', publisher: 'Source 1', quote: 'q1', score: 80, type: 'news' }],
          metadata: { apis_used: [], warnings: [] },
          source_credibility_report: { flaggedSources: 0 },
          temporal_verification: { validations: [] },
          score_breakdown: { metrics: [] }
        }),
        // Mock for the 'temporal-verification' analysis path
        performCitationAugmentedAnalysis: vi.fn().mockResolvedValue({
          id: 'base-report-temporal',
          originalText: 'Test claim about a recent event',
          final_score: 70,
          final_verdict: 'Base temporal analysis verdict',
          evidence: [{ id: 'e2', url: 'http://example.com/source2', publisher: 'Source 2', quote: 'q2', score: 75, type: 'news' }],
          metadata: { apis_used: [], warnings: [] }
        })
      };
    })
  };
});

vi.mock('../services/core/SourceCredibilityService', () => {
  const SourceCredibilityService = {
    getInstance: vi.fn().mockReturnValue({
      analyzeSource: vi.fn().mockResolvedValue({ credibilityScore: 85, category: 'news', verificationStatus: 'verified' }),
      calculateWeightedScore: vi.fn().mockReturnValue(88),
      getBiasWarnings: vi.fn().mockReturnValue(['Potential political bias detected'])
    })
  };
  return { SourceCredibilityService };
});

vi.mock('../services/core/TemporalContextService', () => {
  const TemporalContextService = {
    getInstance: vi.fn().mockReturnValue({
      evaluateTemporalClaims: vi.fn().mockReturnValue([
        { date: '2024-01-01', isValid: true, reasoning: 'Date is consistent' },
        { date: '2025-01-01', isValid: false, reasoning: 'Date is out of context' }
      ])
    })
  };
  return { TemporalContextService };
});

vi.mock('../services/core/CategoryRatingService', () => {
    const CategoryRatingService = {
        getInstance: vi.fn().mockReturnValue({
            convertScoreToCategory: vi.fn().mockReturnValue({ category: 'mostly-true', reasoning: 'The claim is mostly accurate but requires additional context.' })
        })
    };
    return { CategoryRatingService };
});

describe('Streamlined Fact Check System', () => {
  test('Comprehensive analysis includes all components', async () => {
    const service = new EnhancedFactCheckService();
    const result = await service.orchestrateFactCheck('Test claim from 2024', 'comprehensive');

    expect(result.source_credibility_report).toBeDefined();
    expect(result.temporal_verification).toBeDefined();
    expect(result.user_category_recommendations).toBeDefined();
    expect(result.final_verdict).toContain('Comprehensive Analysis');
    expect(result.metadata.warnings).toContain('Potential political bias detected');
    expect(result.metadata.warnings).toContain('Temporal: Date is out of context');
  });

  test('Temporal verification focuses on time-based analysis', async () => {
    const service = new EnhancedFactCheckService();
    const result = await service.orchestrateFactCheck('Test claim about a recent event', 'temporal-verification');

    expect(result.final_verdict).toContain('Temporal Verification');
    expect(result.temporal_verification).toBeDefined();
    expect(result.temporal_verification.overallTemporalScore).toBe(50); // 1 valid out of 2
    expect(result.source_credibility_report).toBeDefined(); // Still has basic credibility
  });

  test('Method capabilities are properly defined', () => {
    const comprehensive = getMethodCapabilities('comprehensive');
    const temporal = getMethodCapabilities('temporal-verification');

    expect(comprehensive.features.sourceVerification).toBe(true);
    expect(comprehensive.features.mediaVerification).toBe(true);
    expect(temporal.features.temporalAnalysis).toBe(true);
    expect(temporal.features.mediaVerification).toBe(false);
  });
});