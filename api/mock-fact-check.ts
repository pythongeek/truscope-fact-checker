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
        claimText: 'This is a test claim.',
        status: 'Verified',
        confidenceScore: 0.85,
        explanation: 'This is a mock explanation.',
      },
    ],
    evidence: [],
    final_score: 85,
    final_verdict: 'Accurate',
    reasoning: 'This is a mock reasoning.',
    score_breakdown: {},
    enhanced_claim_text: 'This is an enhanced test claim.',
    metadata: {
      url: 'http://example.com',
    },
  };

  res.status(200).json(mockReport);
}
