import type { FactCheckResult } from '../types/preCheck';
import { fetchWithRetry } from '../utils/api';

// Simple in-memory cache
const cache = new Map<string, { result: FactCheckResult; timestamp: number }>();
const CACHE_TTL = 1800000; // 30 minutes

const API_KEY = import.meta.env.VITE_FACT_CHECK_API_KEY;
const API_ENDPOINT = 'https://factchecktools.googleapis.com/v1alpha1/claims:search';

/**
 * Normalizes a textual rating from the Fact Check API into a standardized verdict.
 *
 * @param {string} textualRating - The rating string provided by the API (e.g., "Mostly True").
 * @returns {FactCheckResult['verdict']} A standardized verdict ('True', 'False', 'Misleading', or 'Other').
 */
const normalizeVerdict = (textualRating: string): FactCheckResult['verdict'] => {
  const lowerCaseRating = textualRating.toLowerCase();
  if (lowerCaseRating.includes('true') || lowerCaseRating.includes('accurate')) {
    return 'True';
  }
  if (lowerCaseRating.includes('false') || lowerCaseRating.includes('pants on fire')) {
    return 'False';
  }
  if (lowerCaseRating.includes('misleading')) {
    return 'Misleading';
  }
  return 'Other';
};

/**
 * Queries the Google Fact Check Tools API to find existing fact-checks for a given claim.
 * The results are cached in memory to avoid redundant API calls.
 *
 * @param {string} claim - The claim to search for.
 * @returns {Promise<FactCheckResult>} A promise that resolves to a FactCheckResult object.
 * The 'status' field will be 'Found' if a match is found, otherwise 'Not Found'.
 * @throws {Error} If the API key is not configured or if the API call fails.
 */
export const checkForFactCheck = async (claim: string): Promise<FactCheckResult> => {
  if (!API_KEY) {
    throw new Error('Fact Check API key is not configured. Please set VITE_FACT_CHECK_API_KEY in your .env file.');
  }

  // Check cache first
  const cached = cache.get(claim);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.result;
  }

  const url = `${API_ENDPOINT}?query=${encodeURIComponent(claim)}&key=${API_KEY}`;

  try {
    const response = await fetchWithRetry(url);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'An unknown API error occurred.' }));
      console.error('Fact Check API Error:', errorData);
      throw new Error(`API request failed with status ${response.status}: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();

    if (data.claims && data.claims.length > 0) {
      const firstClaim = data.claims[0];
      const review = firstClaim.claimReview[0];

      const result: FactCheckResult = {
        status: 'Found',
        verdict: normalizeVerdict(review.textualRating),
        source: review.publisher.name,
        url: review.url,
        originalClaim: firstClaim.text,
      };

      cache.set(claim, { result, timestamp: Date.now() });
      return result;
    }

    const notFoundResult: FactCheckResult = { status: 'Not Found' };
    cache.set(claim, { result: notFoundResult, timestamp: Date.now() });
    return notFoundResult;

  } catch (error) {
    console.error("Error calling Fact Check API:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to check claim: ${error.message}`);
    }
    throw new Error('An unexpected error occurred while checking the claim.');
  }
};
