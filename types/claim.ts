export interface Claim {
  text: string;
  isVerifiable: boolean;
}

export interface ClaimAnalysisResult {
  claims: Claim[];
}
