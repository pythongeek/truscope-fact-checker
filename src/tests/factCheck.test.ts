import { describe, test, expect, vi } from 'vitest';
import { EnhancedFactCheckService } from '../services/EnhancedFactCheckService';
import { getMethodCapabilities } from '../services/methodCapabilities';

// Mock dependent services to isolate the test to the orchestration logic
vi.mock('../services/analysis/CitationAugmentedService', () => {
  return {
    CitationAugmentedService: vi.fn().mockImplementation(() => {
      return {
        performCitationAugmentedAnalysis: vi.fn().mockResolvedValue({
          id: 'base-report',
          final_score: 75,
          final_verdict: 'Base analysis verdict',
          evidence: [{ id: 'e1', url: 'http://example.com/source1', publisher: 'Source 1', quote: 'q1', score: 80, type: 'news' }],
          metadata: {
            method_used: 'citation-augmented',
            processing_time_ms: 100,
            apis_used: ['base-api'],
            sources_consulted: { total: 1, high_credibility: 1, conflicting: 0 },
            warnings: []
          }
        })
      };
    })
  };
});

vi.mock('../services/core/SourceCredibilityService', () => {
  const SourceCredibilityService = {
    getInstance: vi.fn().mockReturnValue({
      analyzeSource: vi.fn().mockResolvedValue({
        credibilityScore: 85,
        category: 'news',
        verificationStatus: 'verified'
      }),
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
        { isValid: true, reasoning: 'Date is consistent' },
        { isValid: false, reasoning: 'Date is out of context' }
      ])
    })
  };
  return { TemporalContextService };
});

vi.mock('../services/core/CategoryRatingService', () => {
    const CategoryRatingService = {
        getInstance: vi.fn().mockReturnValue({
            convertScoreToCategory: vi.fn().mockReturnValue({
                category: 'mostly-true',
                reasoning: 'The claim is mostly accurate but requires additional context.',
            })
        })
    };
    return { CategoryRatingService };
});


describe('Streamlined Fact Check System', () => {
  test('Comprehensive analysis includes all components', async () => {
    const service = new EnhancedFactCheckService();
    const result = await service.orchestrateFactCheck(
      'Test claim from 2024',
      'comprehensive'
    );

    expect(result.source_credibility_report).toBeDefined();
    expect(result.temporal_verification).toBeDefined();
    expect(result.user_category_recommendations).toBeDefined();
    expect(result.final_verdict).toContain('Comprehensive Analysis');
    expect(result.source_credibility_report.biasWarnings).toContain('Potential political bias detected');
    expect(result.temporal_verification.temporalWarnings).toContain('Date is out of context');
  });

  test('Temporal verification focuses on time-based analysis', async () => {
    const service = new EnhancedFactCheckService();
    const result = await service.orchestrateFactCheck(
        'Test claim about a recent event',
        'temporal-verification'
    );

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