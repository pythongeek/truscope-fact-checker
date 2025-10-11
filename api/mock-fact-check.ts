// api/mock-fact-check.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { FactCheckReport } from '../src/types';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const mockReport: FactCheckReport = {
    id: 'mock-report-123',
    originalText: 'This is a test claim.',
    summary: 'This is a mock summary.',
    overallAuthenticityScore: 85,
    claimVerifications: [
      {
        id: 'mock-claim-1',
        claimText: 'This is a test claim.',
        status: 'Verified',
        confidenceScore: 0.85,
        explanation: 'This is a mock explanation.',
        reasoning: {
          totalSources: 0,
          supportingSources: 0,
          conflictingSources: 0,
          conclusion: 'Mock conclusion',
        },
        evidence: [],
      },
    ],
    evidence: [],
    final_score: 85,
    final_verdict: 'Accurate',
    reasoning: 'This is a mock reasoning.',
    score_breakdown: {
      final_score_formula: 'mock formula',
      metrics: [],
      confidence_intervals: {
        lower_bound: 0,
        upper_bound: 0,
      },
    },
    enhanced_claim_text: 'This is an enhanced test claim.',
    metadata: {
      method_used: 'mock',
      processing_time_ms: 100,
      sources_consulted: {
        total: 0,
        high_credibility: 0,
        conflicting: 0,
      },
      warnings: [],
    },
  };

  res.status(200).json(mockReport);
}
