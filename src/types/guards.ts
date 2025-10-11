import { FactCheckReport, EvidenceItem, TieredFactCheckResult } from './index';

/**
 * Type guard to check if value is FactCheckReport
 */
export function isFactCheckReport(
  value: any
): value is FactCheckReport {
  return (
    value &&
    typeof value === 'object' &&
    'originalText' in value &&
    'final_score' in value
  );
}

/**
 * Safely get report from either type
 */
export function getReport(
  value: FactCheckReport | TieredFactCheckResult | null | undefined
): FactCheckReport | null {
  if (!value) return null;
  if (isFactCheckReport(value)) return value;
  return null;
}
