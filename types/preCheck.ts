/**
 * Represents the result of a pre-check for an existing fact-check article.
 */
export interface FactCheckResult {
  /**
   * The status of the lookup, indicating whether a fact-check was found.
   */
  status: 'Found' | 'Not Found';
  /**
   * The verdict of the fact-check, if found.
   */
  verdict?: 'True' | 'False' | 'Misleading' | 'Other';
  /**
   * The name of the publishing organization that performed the fact-check.
   */
  source?: string;
  /**
   * The URL of the fact-check article.
   */
  url?: string;
  /**
   * The original claim text as interpreted by the fact-checking organization.
   */
  originalClaim?: string;
}
