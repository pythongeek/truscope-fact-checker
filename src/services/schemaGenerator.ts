// src/services/schemaGenerator.ts

import { EvidenceItem } from '../types/factCheck';

interface ClaimReviewSchema {
  '@context': string;
  '@type': string;
  datePublished: string;
  url: string; // URL to the page where this fact-check is published
  claimReviewed: string;
  author: {
    '@type': string;
    name: string;
  };
  reviewRating: {
    '@type': string;
    ratingValue: string;
    bestRating: string;
    worstRating: string;
    alternateName: string; // A textual rating (e.g., "Mostly True")
  };
  itemReviewed: {
    '@type': string;
    author: {
      '@type': string;
      name: string;
      sameAs?: string; // URL of the author, if available
    };
    datePublished: string | null;
    name: string;
  };
}

// Helper to determine a textual rating from the score
function getAlternateName(score: number): string {
    if (score > 85) return "True";
    if (score > 60) return "Mostly True";
    if (score > 40) return "Mixture";
    if (score > 15) return "Mostly False";
    return "False";
}

/**
 * Generates a ClaimReview JSON-LD schema.
 * @param claim The original claim text that was fact-checked.
 * @param score The final validation score (0-100).
 * @param evidence The list of evidence items used for the check.
 * @returns A fully formed ClaimReviewSchema object.
 */
export function generateClaimReviewSchema(
  claim: string,
  score: number,
  evidence: EvidenceItem[]
): ClaimReviewSchema {
  // Use the most relevant piece of evidence for the 'itemReviewed' field
  const primarySource = evidence.length > 0 ? evidence[0] : null;

  return {
    '@context': 'https://schema.org',
    '@type': 'ClaimReview',
    datePublished: new Date().toISOString().split('T')[0], // YYYY-MM-DD
    url: 'https://your-app-domain.com/fact-check/12345', // Placeholder URL
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
