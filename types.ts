export enum ClaimStatus {
  VERIFIED = 'Verified',
  UNCERTAIN = 'Uncertain',
  FALSE = 'False',
}

export interface Claim {
  claim: string;
  status: ClaimStatus;
  explanation: string;
}

export interface Source {
  uri: string;
  title: string;
}

export interface AnalysisResult {
  overallScore: number;
  summary: string;
  claims: Claim[];
  sources?: Source[];
}