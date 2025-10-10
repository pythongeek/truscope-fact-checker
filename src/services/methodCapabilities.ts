import { FactCheckMethod } from '../types';

export interface MethodCapability {
  id: FactCheckMethod;
  name: string;
  description: string;
  strengths: string[];
  limitations: string[];
  processingTime: 'fast' | 'medium' | 'slow';
  accuracyLevel: 'high' | 'very-high';
  requiresInternet: boolean;
  features: {
    sourceVerification: boolean;
    temporalAnalysis: boolean;
    mediaVerification: boolean;
    biasDetection: boolean;
    expertValidation: boolean;
  };
}

export const METHOD_CAPABILITIES: Record<FactCheckMethod, MethodCapability> = {
  comprehensive: {
    id: 'comprehensive',
    name: 'Comprehensive Analysis',
    description: 'Multi-layered professional fact-checking with source credibility, temporal verification, and bias detection',
    strengths: [
      'Combines multiple verification strategies',
      'Source credibility assessment',
      'Temporal consistency checking',
      'Bias detection and warnings',
      'Professional-grade reporting'
    ],
    limitations: [
      'Requires internet connection',
      'Longer processing time',
      'May be complex for simple claims'
    ],
    processingTime: 'medium',
    accuracyLevel: 'very-high',
    requiresInternet: true,
    features: {
      sourceVerification: true,
      temporalAnalysis: true,
      mediaVerification: true,
      biasDetection: true,
      expertValidation: true
    }
  },
  'temporal-verification': {
    id: 'temporal-verification',
    name: 'Temporal Verification',
    description: 'Specialized analysis for time-sensitive claims and breaking news verification',
    strengths: [
      'Excellent for breaking news',
      'Timeline consistency checking',
      'Recent event verification',
      'Fast processing of time-based claims'
    ],
    limitations: [
      'Less effective for non-temporal claims',
      'Requires recent data sources',
      'May miss broader context'
    ],
    processingTime: 'fast',
    accuracyLevel: 'high',
    requiresInternet: true,
    features: {
      sourceVerification: true,
      temporalAnalysis: true,
      mediaVerification: false,
      biasDetection: false,
      expertValidation: false
    }
  },
  'tiered-verification': {
    id: 'tiered-verification',
    name: 'Tiered Verification',
    description: 'A cost-effective, multi-phase approach that escalates from fast, direct checks to comprehensive analysis as needed.',
    strengths: [
      'Cost-efficient by design',
      'Balances speed and accuracy',
      'Starts with the most economical checks',
      'Escalates automatically for complex claims'
    ],
    limitations: [
      'Processing time is variable',
      'Can be slow for claims requiring full escalation',
      'Relies on multiple external APIs'
    ],
    processingTime: 'slow',
    accuracyLevel: 'very-high',
    requiresInternet: true,
    features: {
      sourceVerification: true,
      temporalAnalysis: true,
      mediaVerification: false,
      biasDetection: false,
      expertValidation: true
    }
  }
};

export function getMethodCapabilities(method: FactCheckMethod): MethodCapability {
  return METHOD_CAPABILITIES[method];
}