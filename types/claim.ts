/**
 * Represents a single factual claim extracted from a piece of text.
 */
export interface Claim {
  /**
   * The original text of the claim.
   */
  text: string;
  /**
   * A boolean flag indicating whether the claim is considered verifiable
   * (a statement of fact) or not (an opinion or general assertion).
   */
  isVerifiable: boolean;
}

/**
 * Represents the structured result of a claim extraction analysis.
 */
export interface ClaimAnalysisResult {
  /**
   * An array of claims identified in the analyzed text.
   */
  claims: Claim[];
}
