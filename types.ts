/**
 * An enum representing the possible verification statuses of a claim.
 */
export enum ClaimStatus {
  /**
   * The claim has been confirmed by reliable sources.
   */
  VERIFIED = 'Verified',
  /**
   * There is conflicting or insufficient evidence to verify the claim.
   */
  UNCERTAIN = 'Uncertain',
  /**
   * The claim has been refuted by reliable sources.
   */
  FALSE = 'False',
}

/**
 * Represents a single claim that has been analyzed, including its verification status and an explanation.
 * Note: This is different from the `Claim` type in `types/claim.ts` which is for pre-analysis claims.
 */
export interface Claim {
  /**
   * The text of the claim.
   */
  claim: string;
  /**
   * The verification status of the claim.
   */
  status: ClaimStatus;
  /**
   * A detailed explanation of how the verification status was determined.
   */
  explanation: string;
}

/**
 * Represents a single information source that was consulted during an analysis.
 */
export interface Source {
  /**
   * The URL of the source.
   */
  uri: string;
  /**
   * The title of the source page or document.
   */
  title: string;
}

/**
 * Represents the complete result of a content analysis.
 */
export interface AnalysisResult {
  /**
   * The overall credibility score of the analyzed content, from 0 to 100.
   */
  overallScore: number;
  /**
   * A concise summary of the analysis findings.
   */
  summary: string;
  /**
   * An array of the individual claims analyzed.
   */
  claims: Claim[];
  /**
   * An optional array of sources that were consulted.
   */
  sources?: Source[];
}