export interface FactCheckResult {
  status: 'Found' | 'Not Found';
  verdict?: 'True' | 'False' | 'Misleading' | 'Other';
  source?: string;
  url?: string;
  originalClaim?: string;
}
