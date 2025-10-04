import { describe, test, expect, vi, beforeEach } from 'vitest';
import { EnhancedFactCheckService } from '../services/EnhancedFactCheckService';
import { getMethodCapabilities } from '../services/methodCapabilities';

// Mock the API key service to prevent localStorage errors in Node.js test environment
vi.mock('../services/apiKeyService', () => ({
  getGeminiApiKey: vi.fn().mockReturnValue('test-gemini-api-key'),
  getGeminiModel: vi.fn().mockReturnValue('gemini-pro'),
}));

// Mock dependent services to isolate the test to the orchestration logic
vi.mock('../services/webSearch', () => ({
  search: vi.fn().mockResolvedValue([
    {
      title: 'Mock Search Result: High Credibility',
      link: 'https://www.factcheck.org/mock-article/',
      snippet: 'This is a mocked search result from a credible source.',
      source: 'factcheck.org',
    },
  ]),
  executeMultiStrategySearch: vi.fn().mockResolvedValue([
    {
      title: 'Mock Search Result: High Credibility',
      link: 'https://www.factcheck.org/mock-article/',
      snippet: 'This is a mocked search result from a credible source.',
      source: 'factcheck.org',
    },
  ]),
  assessSourceCredibility: vi.fn().mockReturnValue(95),
}));

vi.mock('../services/analysis/CitationAugmentedService', () => {
  return {
    CitationAugmentedService: vi.fn().mockImplementation(() => {
      const mockReport = {
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
      };
      return {
        performCitationAugmentedAnalysis: vi.fn().mockResolvedValue(mockReport),
        processSearchResults: vi.fn().mockResolvedValue(mockReport),
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

vi.mock('../services/analysis/PipelineIntegration', () => {
  const mockPipelineResult = {
    textAnalysis: {
      namedEntities: [{ text: 'Test Entity', type: 'PERSON', relevance: 90 }],
      atomicClaims: [{ id: 'claim-1', claimText: 'This is a test claim.', claimType: 'factual', verifiability: 'high', priority: 10 }],
      complexity: 'moderate',
      suggestedSearchDepth: 'standard',
      temporalContext: { hasDateReference: true, recency: 'recent' },
      biasIndicators: { overallBiasScore: 40 },
    },
    semanticExtraction: { primaryKeywords: [], searchableKeywordGroups: { highPriority: [], mediumPriority: [] } },
    querySynthesis: { primaryQueries: [], crossReferenceQueries: [], temporalQueries: [], sourceTargetedQueries: { factCheckSites: [], newsAgencies: [], academicSources: [], governmentSources: [] }, queryExecutionPlan: { phase1: [], phase2: [], phase3: [] } },
    validatedQueries: [],
    rankedQueries: [],
    executionPlan: { immediate: [], followUp: [], deepDive: [] },
    cacheKey: 'mock-cache-key',
    metadata: { pipelineVersion: '1.0.0-mock', totalProcessingTime: 150, stagesCompleted: ['all'], timestamp: new Date().toISOString() },
  };

  const mockAggregatedEvidence = [
    { id: 'agg-e1', url: 'http://example.com/agg-source1', publisher: 'Agg Source 1', quote: 'q1-agg', score: 85, type: 'news', source: { name: 'Agg Source 1', url: 'http://example.com/agg-source1', credibility: { rating: 'High', classification: 'News', warnings: [] } } }
  ];

  const mockExecutionMetrics = {
    totalQueriesExecuted: 5,
    totalResultsReturned: 20,
    averageQueryTime: 150,
    phaseTimings: { phase1: 100, phase2: 50, phase3: 0 },
  };

  const PipelineIntegration = {
    getInstance: vi.fn().mockReturnValue({
      processAndSearch: vi.fn().mockResolvedValue({
        pipelineResult: mockPipelineResult,
        aggregatedEvidence: mockAggregatedEvidence,
        executionMetrics: mockExecutionMetrics,
      }),
    }),
  };
  return { PipelineIntegration };
});


describe('Streamlined Fact Check System', () => {
  beforeEach(() => {
    // Mock localStorage for API keys
    const mockLocalStorage = {
      getItem: (key: string) => {
        if (key === 'search_api_key' || key === 'serp_api_key' || key === 'newsdata_api_key' || key === 'fact_check_api_key' || key === 'search_id') {
          return 'test-api-key';
        }
        return null;
      },
      setItem: vi.fn(),
      clear: vi.fn(),
      removeItem: vi.fn(),
      length: 0,
    };
    vi.stubGlobal('localStorage', mockLocalStorage);
  });

  test('Comprehensive analysis includes all components', async () => {
    const service = new EnhancedFactCheckService();
    const result = await service.orchestrateFactCheck(
      'Test claim from 2024',
      'comprehensive'
    );

    expect(result.source_credibility_report).toBeDefined();
    expect(result.temporal_verification).toBeDefined();
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