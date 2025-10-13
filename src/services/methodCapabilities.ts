import { FactCheckMethod } from '@/types';

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
  COMPREHENSIVE: {
    id: 'COMPREHENSIVE',
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
  TEMPORAL: {
    id: 'TEMPORAL',
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
      'Cost-effective approach',
      'Adaptive processing',
      'Balanced speed and accuracy'
    ],
    limitations: [
      'May require escalation for complex claims',
      'Processing time varies by complexity'
    ],
    processingTime: 'medium',
    accuracyLevel: 'high',
    requiresInternet: true,
    features: {
      sourceVerification: true,
      temporalAnalysis: true,
      mediaVerification: false,
      biasDetection: false,
      expertValidation: false,
    },
  },
  CITATION: {
    id: 'CITATION',
    name: 'Citation Analysis',
    description: 'Analyzes the citations and sources within a text to determine its credibility.',
    strengths: [
      'Evaluates source quality',
      'Fast citation verification',
      'Identifies credible references'
    ],
    limitations: [
      'Depends on citation availability',
      'Limited to cited sources'
    ],
    processingTime: 'fast',
    accuracyLevel: 'high',
    requiresInternet: true,
    features: {
      sourceVerification: true,
      temporalAnalysis: false,
      mediaVerification: false,
      biasDetection: false,
      expertValidation: false,
    },
  },
  'google-factcheck': {
    id: 'google-factcheck',
    name: 'Google Fact Check',
    description: 'Leverages Google\'s Fact Check API to find existing fact checks for a claim.',
    strengths: ['Fast', 'Access to a large database of fact checks'],
    limitations: ['Depends on existing fact checks', 'May not have information on new or obscure claims'],
    processingTime: 'fast',
    accuracyLevel: 'high',
    requiresInternet: true,
    features: {
      sourceVerification: true,
      temporalAnalysis: false,
      mediaVerification: false,
      biasDetection: false,
      expertValidation: false,
    },
  },
  'web-search': {
    id: 'web-search',
    name: 'Web Search',
    description: 'Performs a general web search to find information and evidence related to a claim.',
    strengths: ['Broad coverage', 'Can find information on a wide variety of topics'],
    limitations: ['Results can be noisy', 'Requires careful evaluation of sources'],
    processingTime: 'fast',
    accuracyLevel: 'high',
    requiresInternet: true,
    features: {
      sourceVerification: false,
      temporalAnalysis: false,
      mediaVerification: false,
      biasDetection: false,
      expertValidation: false,
    },
  },
  'news-analysis': {
    id: 'news-analysis',
    name: 'News Analysis',
    description: 'Analyzes news articles and other media to evaluate a claim.',
    strengths: ['Can provide context and background information', 'Can help to identify bias and misinformation'],
    limitations: ['Requires access to a variety of news sources', 'Can be time-consuming'],
    processingTime: 'medium',
    accuracyLevel: 'high',
    requiresInternet: true,
    features: {
      sourceVerification: true,
      temporalAnalysis: true,
      mediaVerification: true,
      biasDetection: true,
      expertValidation: false,
    },
  },
  'ai-synthesis': {
    id: 'ai-synthesis',
    name: 'AI Synthesis',
    description: 'Uses AI to synthesize information from multiple sources and generate a summary of the evidence.',
    strengths: ['Can quickly process large amounts of information', 'Can identify patterns and connections that may not be obvious to humans'],
    limitations: ['Can be biased', 'May not be able to understand the nuances of a claim'],
    processingTime: 'medium',
    accuracyLevel: 'high',
    requiresInternet: true,
    features: {
      sourceVerification: false,
      temporalAnalysis: false,
      mediaVerification: false,
      biasDetection: false,
      expertValidation: false,
    },
  },
  'citation-augmented': {
    id: 'citation-augmented',
    name: 'Citation-Augmented Analysis',
    description: 'Enhanced fact-checking that retrieves and verifies evidence from multiple sources to support comprehensive analysis.',
    strengths: [
      'Can help to ensure that a fact-checking investigation is based on the best available evidence', 
      'Can be used to automate the process of collecting evidence',
      'Combines multiple source types for comprehensive coverage'
    ],
    limitations: [
      'May not be able to find all relevant evidence', 
      'May not be able to distinguish between reliable and unreliable evidence'
    ],
    processingTime: 'medium',
    accuracyLevel: 'high',
    requiresInternet: true,
    features: {
      sourceVerification: true,
      temporalAnalysis: false,
      mediaVerification: false,
      biasDetection: false,
      expertValidation: false,
    },
  },
  'statistical-fallback': {
    id: 'statistical-fallback',
    name: 'Statistical Fallback',
    description: 'A fallback method that uses statistical analysis when AI synthesis is unavailable.',
    strengths: [
      'Reliable when AI services are unavailable',
      'Transparent statistical methodology',
      'No dependency on external AI services'
    ],
    limitations: [
      'Less nuanced than AI-powered analysis',
      'Cannot provide contextual reasoning',
      'Limited to quantitative metrics'
    ],
    processingTime: 'fast',
    accuracyLevel: 'high',
    requiresInternet: true,
    features: {
      sourceVerification: true,
      temporalAnalysis: false,
      mediaVerification: false,
      biasDetection: false,
      expertValidation: false,
    },
  },
  'tiered-verification-synthesis': {
    id: 'tiered-verification-synthesis',
    name: 'Tiered Verification with AI Synthesis',
    description: 'Multi-phase verification approach enhanced with AI-powered synthesis of findings.',
    strengths: [
      'Combines tiered efficiency with AI insights',
      'Adaptive processing based on complexity',
      'Comprehensive synthesis of multiple sources'
    ],
    limitations: [
      'Requires AI API access',
      'Processing time varies by claim complexity',
      'Higher resource usage than basic methods'
    ],
    processingTime: 'medium',
    accuracyLevel: 'very-high',
    requiresInternet: true,
    features: {
      sourceVerification: true,
      temporalAnalysis: true,
      mediaVerification: false,
      biasDetection: true,
      expertValidation: false,
    },
  },
  'tiered-statistical-fallback': {
    id: 'tiered-statistical-fallback',
    name: 'Tiered Verification with Statistical Fallback',
    description: 'Multi-phase verification approach using statistical analysis when AI synthesis is unavailable.',
    strengths: [
      'Reliable operation without AI dependencies',
      'Cost-effective tiered approach',
      'Transparent statistical methodology'
    ],
    limitations: [
      'Less contextual reasoning than AI-powered methods',
      'Cannot provide nuanced explanations',
      'Limited to quantitative analysis'
    ],
    processingTime: 'medium',
    accuracyLevel: 'high',
    requiresInternet: true,
    features: {
      sourceVerification: true,
      temporalAnalysis: true,
      mediaVerification: false,
      biasDetection: false,
      expertValidation: false,
    },
  },
};

export function getMethodCapabilities(method: FactCheckMethod): MethodCapability {
  return METHOD_CAPABILITIES[method];
}
