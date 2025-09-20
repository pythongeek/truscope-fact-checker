import { SourceReliabilityScore } from '../types/enhancedFactCheck';

// File: src/data/sourceReliability.ts
export const RELIABLE_SOURCES_DB: SourceReliabilityScore[] = [
  // Tier 1: Highly Reliable (90-100)
  { domain: 'reuters.com', reliabilityScore: 95, category: 'news', biasRating: 'center', lastUpdated: '2025-01-01', verificationCount: 0 },
  { domain: 'apnews.com', reliabilityScore: 94, category: 'news', biasRating: 'center', lastUpdated: '2025-01-01', verificationCount: 0 },
  { domain: 'bbc.com', reliabilityScore: 90, category: 'news', biasRating: 'center-left', lastUpdated: '2025-01-01', verificationCount: 0 },

  // Tier 2: Fact-Checking Sites (85-95)
  { domain: 'snopes.com', reliabilityScore: 88, category: 'fact_check', biasRating: 'center', lastUpdated: '2025-01-01', verificationCount: 0 },
  { domain: 'politifact.com', reliabilityScore: 87, category: 'fact_check', biasRating: 'center-left', lastUpdated: '2025-01-01', verificationCount: 0 },
  { domain: 'factcheck.org', reliabilityScore: 89, category: 'fact_check', biasRating: 'center', lastUpdated: '2025-01-01', verificationCount: 0 },

  // Tier 3: Academic Sources (90-98)
  { domain: 'pubmed.ncbi.nlm.nih.gov', reliabilityScore: 96, category: 'academic', biasRating: 'center', lastUpdated: '2025-01-01', verificationCount: 0 },
  { domain: 'scholar.google.com', reliabilityScore: 92, category: 'academic', biasRating: 'center', lastUpdated: '2025-01-01', verificationCount: 0 },

  // Tier 4: Government Sources (88-95)
  { domain: 'cdc.gov', reliabilityScore: 94, category: 'government', biasRating: 'center', lastUpdated: '2025-01-01', verificationCount: 0 },
  { domain: 'census.gov', reliabilityScore: 93, category: 'government', biasRating: 'center', lastUpdated: '2025-01-01', verificationCount: 0 },

  // Add 100+ more sources...
];

export const getSourceReliability = (domain: string): SourceReliabilityScore | null => {
  return RELIABLE_SOURCES_DB.find(source => domain.includes(source.domain)) || null;
};
