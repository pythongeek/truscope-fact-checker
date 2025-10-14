// src/services/schemaGenerator.ts - FIXED TYPE ERRORS
// Uses correct TieredFactCheckResult properties and removes unnecessary '@context'

import { TieredFactCheckResult } from '@/types';
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
  // FIX: Use correct properties from the TieredFactCheckResult type.
  const claim = factCheckResult.originalText;
  const score = factCheckResult.overallAuthenticityScore;

  // Aggregate evidence from all claim verifications
  const allEvidence = (factCheckResult.claimVerifications || []).flatMap(v => v.evidence);
  
  // Use the most relevant piece of evidence for the 'itemReviewed' field
  const primarySource = allEvidence.length > 0 ? allEvidence[0] : null;

  // FIX: ClaimReview doesn't require '@context' in the object literal when using schema-dts.
  // The library handles this automatically.
  const claimReview: ClaimReview = {
    '@type': 'ClaimReview',
    datePublished: new Date().toISOString().split('T')[0], // YYYY-MM-DD
    // FIX: Use factCheckResult.id which is a valid property on the type.
    url: `https://your-app-domain.com/fact-check/${factCheckResult.id}`,
    claimReviewed: claim,
    author: {
      '@type': 'Organization',
      name: 'TruScope Fact-Checkers',
    },
    reviewRating: {
      '@type': 'Rating',
      ratingValue: (score ?? 0).toString(),
      bestRating: '100',
      worstRating: '0',
      alternateName: getAlternateName(score ?? 0),
    },
    itemReviewed: {
      '@type': 'CreativeWork',
      author: {
        '@type': 'Organization',
        name: primarySource?.publisher || "Multiple Sources",
        sameAs: primarySource?.url || undefined
      },
      datePublished: primarySource?.publicationDate ? new Date(primarySource.publicationDate).toISOString().split('T')[0] : undefined,
      name: primarySource?.publisher || claim,
    },
  };

  return claimReview;
}

export const schemaGenerator = {
  generate,
};
