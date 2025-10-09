import { describe, test, expect, vi, beforeEach } from 'vitest';
import { EnhancedFactCheckService } from '../services/EnhancedFactCheckService';
import { TieredFactCheckService } from '../services/tieredFactCheckService';
import { getMethodCapabilities } from '../services/methodCapabilities';
import { simpleIntelligentQuerySynthesizer } from '../services/analysis/SimpleIntelligentQuerySynthesizer';

// Mock the API key service to prevent localStorage errors in Node.js test environment
vi.mock('../services/apiKeyService', () => ({
  getGeminiApiKey: vi.fn().mockReturnValue('test-gemini-api-key'),
  getGeminiModel: vi.fn().mockReturnValue('gemini-pro'),
}));

vi.mock('../services/geminiService', () => ({
  geminiService: {
    generateText: vi.fn().mockResolvedValue(
      JSON.stringify({
        keywordQuery: 'mock keyword query',
        contextualQuery: 'mock contextual query',
      })
    ),
  },
  generateTextWithFallback: vi.fn().mockResolvedValue(
    JSON.stringify({
        "final_verdict": "Mock Synthesis Verdict",
        "final_score": 90,
        "reasoning": "This is a mocked synthesis result.",
        "score_breakdown": { "metrics": [] }
    })
  )
}));

vi.mock('../services/googleFactCheckService', () => ({
  GoogleFactCheckService: {
    getInstance: vi.fn().mockReturnValue({
      searchClaims: vi.fn().mockResolvedValue({
        evidence: [{ id: 'gfc1', publisher: 'gfc', quote: 'gfc quote', score: 85, type: 'claim' }],
        final_score: 85,
      }),
    }),
  },
}));

vi.mock('../services/webzNewsService', () => ({
  WebzNewsService: vi.fn().mockImplementation(() => ({
    searchNews: vi.fn().mockResolvedValue({
      posts: [{ uuid: 'news1', author: 'news author', url: 'http://news.com/1', text: 'news text', published: '2024-01-01' }],
    }),
  })),
}));

vi.mock('../services/serpApiService', () => ({
  SerpApiService: {
    getInstance: vi.fn().mockReturnValue({
      search: vi.fn().mockResolvedValue({
        results: [{ source: 'serp', link: 'http://serp.com/1', snippet: 'serp snippet' }],
      }),
    }),
  },
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
          warnings: [],
        },
        source_credibility_report: { overallScore: 80, highCredibilitySources: 1, flaggedSources: 0, biasWarnings: [], credibilityBreakdown: { academic: 0, news: 1, government: 0, social: 0 } },
        temporal_verification: { hasTemporalClaims: false, validations: [], overallTemporalScore: 100, temporalWarnings: [] },
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

vi.mock('../services/analysis/SimpleIntelligentQuerySynthesizer', () => ({
  simpleIntelligentQuerySynthesizer: {
    generateQueries: vi.fn().mockResolvedValue({
      keywordQuery: 'test keyword query',
      contextualQuery: 'test contextual query',
    }),
  },
}));

vi.mock('../services/advancedCacheService', () => ({
  AdvancedCacheService: {
    getInstance: vi.fn().mockReturnValue({
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

vi.mock('../services/blobStorage', () => ({
  BlobStorageService: {
    getInstance: vi.fn().mockReturnValue({
      saveReport: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

vi.mock('../services/performanceMonitor', () => ({
  PerformanceMonitor: {
    getInstance: vi.fn().mockReturnValue({
      recordMetric: vi.fn(),
    }),
  },
}));

vi.mock('../services/EnhancedFactCheckService', () => {
  const mockReport = {
    id: 'enhanced-report',
    final_score: 80,
    final_verdict: 'Enhanced analysis verdict',
    evidence: [{ id: 'enhanced-e1', url: 'http://example.com/enhanced', publisher: 'Enhanced Source', quote: 'q-enhanced', score: 88, type: 'news' }],
    metadata: {},
    source_credibility_report: { overallScore: 80, highCredibilitySources: 1, flaggedSources: 0, biasWarnings: [], credibilityBreakdown: { academic: 0, news: 1, government: 0, social: 0 } },
    temporal_verification: { hasTemporalClaims: false, validations: [], overallTemporalScore: 100, temporalWarnings: [] },
  };
  return {
    __esModule: true,
    EnhancedFactCheckService: vi.fn().mockImplementation(() => ({
      orchestrateFactCheck: vi.fn().mockResolvedValue(mockReport),
    })),
  };
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

  test('Method capabilities are properly defined', () => {
    const comprehensive = getMethodCapabilities('comprehensive');
    const temporal = getMethodCapabilities('temporal-verification');

    expect(comprehensive.features.sourceVerification).toBe(true);
    expect(comprehensive.features.mediaVerification).toBe(true);
    expect(temporal.features.temporalAnalysis).toBe(true);
    expect(temporal.features.mediaVerification).toBe(false);
  });
});

describe('TieredFactCheckService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should perform a tiered check and return a TieredFactCheckResult', async () => {
    const service = new TieredFactCheckService();
    const medicalClaim = 'A new vaccine has been developed that is 100% effective.';
    const result = await service.performTieredCheck(medicalClaim, 'journalism');

    // Assert the main structure of TieredFactCheckResult
    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('timestamp');
    expect(result).toHaveProperty('originalText', medicalClaim);
    expect(result).toHaveProperty('overallAuthenticityScore');
    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('claimVerifications');
    expect(result).toHaveProperty('searchPhases');

    // Assert claimVerifications structure
    expect(Array.isArray(result.claimVerifications)).toBe(true);
    expect(result.claimVerifications.length).toBeGreaterThan(0);
    const firstVerification = result.claimVerifications[0];
    expect(firstVerification).toHaveProperty('id');
    expect(firstVerification).toHaveProperty('claimText', medicalClaim);
    expect(firstVerification).toHaveProperty('status');
    expect(firstVerification).toHaveProperty('confidenceScore');
    expect(firstVerification).toHaveProperty('explanation');
    expect(firstVerification).toHaveProperty('evidence');

    // Assert searchPhases structure and data from mocks
    expect(result.searchPhases).toBeDefined();
    expect(result.searchPhases.googleFactChecks).toBeDefined();
    expect(result.searchPhases.googleFactChecks.queryUsed).toBe('test keyword query');
    expect(result.searchPhases.googleFactChecks.count).toBe(1);
    expect(result.searchPhases.googleFactChecks.rawResults[0].id).toBe('gfc1');

    expect(result.searchPhases.newsSearches).toBeDefined();
    expect(result.searchPhases.newsSearches.queryUsed).toBe('test keyword query');

    expect(result.searchPhases.webSearches).toBeDefined();
    const expectedWebQuery = "test contextual query site:cdc.gov OR site:who.int OR site:nih.gov";
    expect(result.searchPhases.webSearches.queryUsed).toContain('test contextual query');

    // Check that evidence from different phases is aggregated
    const evidenceIds = firstVerification.evidence.map(e => e.id);
    expect(evidenceIds).toContain('gfc1');
    expect(evidenceIds).toContain('enhanced-e1');
  });
});