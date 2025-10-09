// src/services/schemaGenerator.ts

import { EvidenceItem, TieredFactCheckResult } from '../types/factCheck';
import { ClaimReview } from 'schema-dts';

// Helper to determine a textual rating from the score
function getAlternateName(score: number): string {
    if (score > 85) return "True";
    if (score > 60) return "Mostly True";
    if (score > 40) return "Mixture";
    if (score > 15) return "Mostly False";
    return "False";
}

/**
 * Generates a ClaimReview JSON-LD schema based on the tiered fact-check result.
 * @param factCheckResult The result from the TieredFactCheckService.
 * @returns A fully formed ClaimReview object.
 */
function generate(factCheckResult: TieredFactCheckResult): ClaimReview {
  const { originalText: claim, overallAuthenticityScore: score } = factCheckResult;

  // Aggregate evidence from all claim verifications
  const allEvidence = factCheckResult.claimVerifications.flatMap(v => v.evidence);

  // Use the most relevant piece of evidence for the 'itemReviewed' field
  const primarySource = allEvidence.length > 0 ? allEvidence[0] : null;

  return {
    '@context': 'https://schema.org',
    '@type': 'ClaimReview',
    datePublished: new Date().toISOString().split('T')[0], // YYYY-MM-DD
    url: `https://your-app-domain.com/fact-check/${factCheckResult.id}`, // Use the result ID for a unique URL
    claimReviewed: claim,
    author: {
      '@type': 'Organization',
      name: 'TruScope Fact-Checkers', // Your organization's name
    },
    reviewRating: {
      '@type': 'Rating',
      ratingValue: score.toString(),
      bestRating: '100',
      worstRating: '0',
      alternateName: getAlternateName(score),
    },
    itemReviewed: {
      '@type': 'CreativeWork',
      author: {
        '@type': 'Organization', // Or 'Person'
        name: primarySource?.publisher || "Multiple Sources",
        sameAs: primarySource?.url || undefined
      },
      datePublished: primarySource?.publishedDate ? new Date(primarySource.publishedDate).toISOString().split('T')[0] : null,
      name: primarySource?.publisher || claim,
    },
  };
}

export const schemaGenerator = {
  generate,
};