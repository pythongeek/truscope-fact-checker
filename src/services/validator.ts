// src/services/validator.ts

import { EvidenceItem } from '../types';

// Constants for scoring logic
const BASE_SCORE = 20;
const CORROBORATION_BONUS = 15; // Bonus for each additional source
const RECENCY_BOOST_MAX = 20; // Max bonus for very recent articles
const RECENCY_DECAY_DAYS = 90; // Articles older than this get no recency boost

/**
 * Calculates a penalty for older sources.
 * The penalty increases linearly up to RECENCY_DECAY_DAYS.
 * @param publishedDate - The ISO string of the publication date.
 * @returns A score boost from 0 to RECENCY_BOOST_MAX.
 */
function getRecencyBoost(publishedDate: string | null): number {
  if (!publishedDate) {
    return 0;
  }
  const pubDate = new Date(publishedDate);
  const today = new Date();
  const ageInDays = (today.getTime() - pubDate.getTime()) / (1000 * 3600 * 24);

  if (ageInDays < 0 || ageInDays > RECENCY_DECAY_DAYS) {
    return 0;
  }

  // Linear decay for the boost
  const boost = RECENCY_BOOST_MAX * (1 - ageInDays / RECENCY_DECAY_DAYS);
  return Math.round(boost);
}

/**
 * Computes a final validation score based on a list of evidence items.
 * @param evidenceList - An array of EvidenceItem objects.
 * @returns An object containing the final score and the scored evidence list.
 */
export function computeValidatedScore(evidenceList: EvidenceItem[]) {
  if (evidenceList.length === 0) {
    return { finalScore: 0, scoredEvidence: [] };
  }

  // 1. Calculate per-evidence scores
  const scoredEvidence = evidenceList.map(item => {
      const recencyBoost = getRecencyBoost(item.published_at);
      // More factors like domain authority can be added here later
      const individualScore = Math.min(100, (item.confidence_score * 100) + recencyBoost);
      return { ...item, confidence_score: parseFloat((individualScore / 100).toFixed(2)) };
  });

  // 2. Calculate corroboration bonus
  const uniqueSources = new Set(evidenceList.map(e => e.metadata.api_source));
  const corroborationBonus = Math.max(0, (uniqueSources.size - 1) * CORROBORATION_BONUS);

  // 3. Aggregate the final score
  let totalScore = BASE_SCORE + corroborationBonus;

  // Add the average of the individual evidence scores
  const averageEvidenceScore = scoredEvidence.reduce((sum, item) => sum + (item.confidence_score * 100), 0) / scoredEvidence.length;
  totalScore += averageEvidenceScore * 0.5; // Weight the evidence score contribution

  const finalScore = Math.min(100, Math.round(totalScore));

  return { finalScore, scoredEvidence };
}
