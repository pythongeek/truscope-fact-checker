// src/types/enums.ts

// Standardize FactCheckMethod to fix comparison errors
export enum FactCheckMethod {
  SIMPLE = 'simple',
  STANDARD = 'standard',
  COMPREHENSIVE = 'comprehensive',
  TEMPORAL = 'temporal-verification',
}

// Standardize EditorMode to fix comparison errors
export enum EditorMode {
  NEUTRAL = 'neutral',
  CONCISE = 'concise',
  DETAILED = 'detailed',
  ENHANCED = 'enhanced',
  REWRITE = 'complete-rewrite',
}
