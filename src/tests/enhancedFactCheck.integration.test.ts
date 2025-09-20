import { describe, test, expect, beforeEach, vi } from 'vitest';
import { EnhancedFactCheckService } from '../services/enhancedFactCheckService';
import { FactCheckReport } from '../types/factCheck';
import { MultiSourceVerifier } from '../services/multiSourceVerifier';
import { IntelligentCorrector } from '../services/intelligentCorrector';
import { AdvancedEvidenceScorer } from '../services/advancedScoring';

// Mock the modules
vi.mock('../services/multiSourceVerifier');
vi.mock('../services/intelligentCorrector');
vi.mock('../services/advancedScoring');

describe('EnhancedFactCheckService Integration', () => {
  let service: EnhancedFactCheckService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock the implementation of the methods on the imported classes
    vi.mocked(MultiSourceVerifier.prototype).verifyWithMultipleSources.mockResolvedValue([]);
    vi.mocked(IntelligentCorrector.prototype).analyzeForCorrections.mockResolvedValue({
      totalIssues: 1,
      issues: [{ type: 'factual_error', severity: 'high', description: 'Test issue', originalText: 'flat', startIndex: 12, endIndex: 16, confidence: 95 }],
      overallAccuracy: 25,
      recommendedAction: 'major_revision'
    });
    vi.mocked(IntelligentCorrector.prototype).generateSmartCorrections.mockResolvedValue([
      { id: 'corr-1', correctedStatement: 'The Earth is round.', originalStatement: 'The Earth is flat', specificIssues: [], correctInformation: '', supportingSources: [], confidence: 95, alternativePhrasings: [], correctionReasoning: '' }
    ]);
    vi.mocked(AdvancedEvidenceScorer.prototype).enhanceEvidenceWithMetadata.mockImplementation((e) => ({ ...e, score: 100, sourceCredibility: 100, authorCredibility: 100, recency: 100, relevanceScore: 100, contradictsClaim: false, supportsClaim: true, factCheckVerdict: 'true', biasScore: 0, lastVerified: '' }));

    service = new EnhancedFactCheckService();
  });

  test('should enhance a basic report and generate corrections', async () => {
    const mockReport: FactCheckReport = {
      originalText: 'The Earth is flat',
      final_verdict: 'Test',
      final_score: 50,
      evidence: [{ id: 'ev-1', quote: 'Some evidence', publisher: 'test', score: 50, type: 'news' }],
      metadata: {
        method_used: 'test',
        processing_time_ms: 0,
        apis_used: ['test'],
        sources_consulted: { total: 1, high_credibility: 0, conflicting: 0 },
        warnings: []
      },
      score_breakdown: {
        final_score_formula: 'test',
        metrics: []
      },
      enhanced_claim_text: 'The Earth is flat'
    };

    const result = await service.enhanceFactCheckReport(
      mockReport,
      'The Earth is flat'
    );

    expect(result.enhancedReport).toBeDefined();
    expect(result.corrections).toBeDefined();
    expect(result.corrections.length).toBe(1);
    expect(result.corrections[0].correctedStatement).toBe('The Earth is round.');

    // Check that the services were called
    expect(MultiSourceVerifier.prototype.verifyWithMultipleSources).toHaveBeenCalledWith('The Earth is flat');
    expect(AdvancedEvidenceScorer.prototype.enhanceEvidenceWithMetadata).toHaveBeenCalledTimes(1);
    expect(IntelligentCorrector.prototype.analyzeForCorrections).toHaveBeenCalled();
    expect(IntelligentCorrector.prototype.generateSmartCorrections).toHaveBeenCalled();
  });

  test('should not generate corrections if no issues are found', async () => {
    // Override the mock for this specific test
    vi.mocked(IntelligentCorrector.prototype).analyzeForCorrections.mockResolvedValue({
      totalIssues: 0,
      issues: [],
      overallAccuracy: 100,
      recommendedAction: 'minor_edits'
    });

    const mockReport: FactCheckReport = {
      originalText: 'The Earth is round',
      final_verdict: 'Test',
      final_score: 100,
      evidence: [],
      metadata: {
        method_used: 'test',
        processing_time_ms: 0,
        apis_used: ['test'],
        sources_consulted: { total: 0, high_credibility: 0, conflicting: 0 },
        warnings: []
      },
      score_breakdown: {
        final_score_formula: 'test',
        metrics: []
      },
      enhanced_claim_text: 'The Earth is round'
    };

    const result = await service.enhanceFactCheckReport(
      mockReport,
      'The Earth is round'
    );

    expect(result.corrections.length).toBe(0);
    expect(IntelligentCorrector.prototype.generateSmartCorrections).not.toHaveBeenCalled();
  });
});
