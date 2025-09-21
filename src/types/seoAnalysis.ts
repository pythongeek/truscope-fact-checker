export interface SEOAnalysis {
  overallScore: number;
  keywordAnalysis: KeywordAnalysis;
  readability: ReadabilityMetrics;
  structure: ContentStructure;
  schemaMarkup: SchemaMarkupSuggestion[];
  metaOptimization: MetaOptimization;
  linkAnalysis: LinkAnalysis;
  recommendations: SEORecommendation[];
}

export interface KeywordAnalysis {
  primaryKeyword?: string;
  secondaryKeywords: string[];
  keywordDensity: KeywordDensityMetric[];
  lsiKeywords: string[];
  missingKeywords: string[];
}

export interface ReadabilityMetrics {
  fleschScore: number;
  fleschKincaidGrade: number;
  sentenceLength: number;
  paragraphLength: number;
  passiveVoicePercentage: number;
  readingTime: number;
}

export interface SchemaMarkupSuggestion {
  type: 'ClaimReview' | 'Article' | 'NewsArticle' | 'FAQPage' | 'Organization';
  jsonLd: string;
  explanation: string;
  priority: 'high' | 'medium' | 'low';
}

export interface ContentStructure {
  hasHeadings: boolean;
  headingCount: number;
  hasBulletPoints: boolean;
  hasNumberedLists: boolean;
  headingStructure: HeadingStructureAnalysis;
  paragraphCount: number;
  averageParagraphLength: number;
  hasIntroduction: boolean;
  hasConclusion: boolean;
  contentFlow: 'excellent' | 'good' | 'needs-improvement' | 'poor';
}

export interface HeadingStructureAnalysis {
  hasH1: boolean;
  hasH2: boolean;
  hasH3: boolean;
  properHierarchy: boolean;
  h1Count: number;
  h2Count: number;
  h3Count: number;
  headingDistribution: 'balanced' | 'top-heavy' | 'bottom-heavy' | 'unbalanced';
}

export interface MetaOptimization {
  title: MetaElement;
  description: MetaElement;
  keywords?: MetaElement;
  ogTitle?: MetaElement;
  ogDescription?: MetaElement;
  twitterTitle?: MetaElement;
  twitterDescription?: MetaElement;
}

export interface MetaElement {
  current: string;
  optimized: string;
  length: number;
  recommendations: string[];
  score: number; // 0-100
  issues: string[];
}

export interface LinkAnalysis {
  internal: InternalLinkOpportunity[];
  external: ExternalLinkOpportunity[];
  recommendations: string[];
  totalLinks: number;
  internalLinkRatio: number;
  externalLinkRatio: number;
  brokenLinks: string[];
  anchorTextAnalysis: AnchorTextAnalysis;
}

export interface InternalLinkOpportunity {
  anchor: string;
  suggestedUrl: string;
  relevanceScore: number;
  context: string;
  priority: 'high' | 'medium' | 'low';
  reasoning: string;
}

export interface ExternalLinkOpportunity {
  anchor: string;
  suggestedDomain: string;
  relevanceScore: number;
  authorityScore: number;
  context: string;
  reasoning: string;
}

export interface AnchorTextAnalysis {
  overOptimized: boolean;
  keywordStuffing: boolean;
  naturalDistribution: boolean;
  brandedAnchors: number;
  exactMatchAnchors: number;
  partialMatchAnchors: number;
  genericAnchors: number;
}

export interface SEORecommendation {
  type: 'keyword' | 'readability' | 'structure' | 'meta' | 'links' | 'images' | 'performance' | 'schema';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
  category: 'technical' | 'content' | 'optimization';
  implementationSteps: string[];
  expectedResults: string;
  timeframe: 'immediate' | 'short-term' | 'long-term';
}

export interface KeywordDensityMetric {
  keyword: string;
  count: number;
  density: number; // percentage
  isTarget: boolean;
  position: 'title' | 'headings' | 'body' | 'meta' | 'alt-text';
  proximity: number; // average distance between keyword occurrences
  semanticVariations: string[];
  competitorDensity?: number;
  optimalRange: {
    min: number;
    max: number;
  };
}

// Additional supporting types
export interface ImageOptimization {
  totalImages: number;
  missingAltText: number;
  oversizedImages: number;
  unoptimizedFormats: number;
  recommendations: string[];
}

export interface TechnicalSEO {
  pageSpeed: number;
  mobileOptimization: number;
  crawlability: number;
  indexability: number;
  httpsSecure: boolean;
  canonicalTags: boolean;
  robotsTxt: boolean;
  sitemapPresent: boolean;
}
