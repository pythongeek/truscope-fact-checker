import { AdvancedEvidenceScorer } from './advancedScoring';
import { EvidenceItem } from '../types/factCheck';

interface ScoredEvidenceResponse {
  finalScore: number;
  scoredEvidence: EvidenceItem[];
}

export function computeValidatedScore(evidence: EvidenceItem[]): ScoredEvidenceResponse {
  const scorer = new AdvancedEvidenceScorer();

  if (evidence.length === 0) {
    return {
      finalScore: 0,
      scoredEvidence: [],
    };
  }

  const scoredEvidence = evidence.map(item => {
    // The scorer's enhance method adds the necessary properties for scoring
    const advancedItem = scorer.enhanceEvidenceWithMetadata(item);
    // The scorer's calculate method returns a simple score
    const score = scorer.calculateAdvancedScore(advancedItem);

    return { ...item, score };
  });

  // Calculate the final score as an average of all evidence scores
  const totalScore = scoredEvidence.reduce((sum, item) => sum + item.score, 0);
  const finalScore = Math.round(totalScore / scoredEvidence.length);

  return { finalScore, scoredEvidence };
}
