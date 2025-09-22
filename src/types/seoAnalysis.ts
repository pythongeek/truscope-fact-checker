// Basic SEO Analysis Types
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

export interface KeywordDensityMetric {
  keyword: string;
  count: number;
  density: number;
  isTarget: boolean;
}

export interface ReadabilityMetrics {
  fleschScore: number;
  fleschKincaidGrade: number;
  sentenceLength: number;
  paragraphLength: number;
  passiveVoicePercentage: number;
  readingTime: number;
}

export interface ContentStructure {
  hasHeadings: boolean;
  headingCount: number;
  hasBulletPoints: boolean;
  hasNumberedLists: boolean;
  headingStructure: HeadingStructureAnalysis;
}

export interface HeadingStructureAnalysis {
  hasH1: boolean;
  hasH2: boolean;
  hasH3: boolean;
  properHierarchy: boolean;
}

export interface SchemaMarkupSuggestion {
  type: 'ClaimReview' | 'Article' | 'NewsArticle' | 'FAQPage' | 'Organization' | 'BlogPosting';
  jsonLd: string;
  explanation: string;
  priority: 'high' | 'medium' | 'low';
}

export interface MetaOptimization {
  title: MetaElement;
  description: MetaElement;
}

export interface MetaElement {
  current: string;
  optimized: string;
  length: number;
  recommendations: string[];
}

export interface LinkAnalysis {
  internal: InternalLinkOpportunity[];
  external: ExternalLinkOpportunity[];
  recommendations: string[];
}

export interface InternalLinkOpportunity {
  anchor: string;
  suggestedUrl: string;
  relevanceScore: number;
}

export interface ExternalLinkOpportunity {
  anchor: string;
  suggestedDomain: string;
  relevanceScore: number;
}

export interface SEORecommendation {
  type: 'keyword' | 'readability' | 'structure' | 'meta' | 'links';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  action: string;
  expectedImpact: 'high' | 'medium' | 'low';
}

// Advanced SEO Types
export interface ContentOutline {
  title: string;
  metaDescription: string;
  headings: HeadingStructure;
  keywordDistribution: KeywordDistribution;
  internalLinkSuggestions: InternalLinkPlan;
  contentLength: ContentLengthRecommendation;
  faqSection: FAQQuestion[];
}

export interface HeadingStructure {
  h1: string;
  h2Sections: string[];
  h3Subsections: { [key: string]: string[] };
}

export interface KeywordDistribution {
  primary: KeywordPlacement;
  secondary: KeywordPlacement[];
  lsi: KeywordPlacement[];
}

export interface KeywordPlacement {
  keyword: string;
  targetDensity: number;
  placements: string[];
}

export interface InternalLinkPlan {
  contextualLinks: LinkSuggestion[];
  navigationLinks: LinkSuggestion[];
  footerLinks: LinkSuggestion[];
}

export interface LinkSuggestion {
  anchorText: string;
  suggestedUrl: string;
  placement: string;
  relevanceScore: number;
}

export interface ContentLengthRecommendation {
  minWords: number;
  optimalWords: number;
  maxWords: number;
  reasoning: string;
}

export interface FAQQuestion {
  question: string;
  suggestedAnswer: string;
  searchVolume: number;
  difficulty: 'low' | 'medium' | 'high';
}

// Competitor Analysis Types
export interface CompetitorAnalysis {
  averageContentLength: number;
  commonKeywords: KeywordFrequency[];
  headingPatterns: HeadingPattern[];
  contentGaps: ContentGap[];
  recommendations: string[];
}

export interface CompetitorPageAnalysis {
  url: string;
  title: string;
  metaDescription: string;
  contentLength: number;
  headingCount: number;
  keywords: string[];
  internalLinks: number;
  externalLinks: number;
  images: number;
}

export interface KeywordFrequency {
  keyword: string;
  frequency: number;
}

export interface HeadingPattern {
  pattern: string;
  frequency: number;
  effectiveness: 'high' | 'medium' | 'low';
}

export interface ContentGap {
  topic: string;
  opportunity: 'high' | 'medium' | 'low';
  reason: string;
}

// Technical SEO Audit Types
export interface TechnicalSEOAudit {
  pageTitleOptimization: SEOAuditResult;
  metaDescriptionOptimization: SEOAuditResult;
  headingStructure: SEOAuditResult;
  imageOptimization: SEOAuditResult;
  internalLinking: SEOAuditResult;
  schemaMarkup: SEOAuditResult;
  mobileOptimization: SEOAuditResult;
  pageSpeedFactors: SEOAuditResult;
}

export interface SEOAuditResult {
  status: 'good' | 'needs-improvement' | 'critical' | 'missing';
  score: number;
  issues: string[];
  recommendations: string[];
}

// Content Planning Types
export interface ContentPlan {
  topic: string;
  targetKeywords: string[];
  contentType: 'blog-post' | 'guide' | 'tutorial' | 'review' | 'comparison';
  outline: ContentOutline;
  competitorAnalysis: CompetitorAnalysis;
  seoStrategy: SEOStrategy;
}

export interface SEOStrategy {
  primaryGoal: 'traffic' | 'conversions' | 'brand-awareness' | 'authority';
  targetAudience: string;
  contentPillars: string[];
  distributionChannels: string[];
  successMetrics: string[];
}

// Performance Reporting Types
export interface ContentPerformanceReport {
    summary: {
      seoHealthScore: number;
      totalViews: number;
      averagePosition: number;
      totalConversions: number;
    };
    keyMetrics: {
      engagement: {
        bounceRate: number;
        timeOnPage: number;
        socialShares: number;
        backlinks: number;
        engagementScore: number;
      };
      trafficSources: { name: string; value: number; color: string; }[];
      rankings: {
        totalKeywords: number;
        improved: number;
        declined: number;
        stable: number;
        topKeywords: {
          keyword: string;
          searchVolume: number;
          difficulty: number;
          position: number;
          previousPosition: number;
        }[];
      };
    };
    trafficTrend: { date: string; traffic: number; conversions: number; }[];
    recommendations: {
      type: 'keyword' | 'readability' | 'structure' | 'meta' | 'links';
      priority: 'high' | 'medium' | 'low';
      title: string;
      description: string;
      action: string;
      expectedImpact: 'high' | 'medium' | 'low';
    }[];
    opportunityAnalysis: {
      quickWins: {
        keyword: string;
        currentPosition: number;
        searchVolume: number;
        difficulty: number;
        estimatedTrafficGain: number;
      }[];
      longTermOpportunities: {
        keyword: string;
        currentPosition: number;
        searchVolume: number;
        difficulty: number;
        estimatedTrafficGain: number;
      }[];
      contentGaps: string[];
    };
    competitorComparison: {
      averageTraffic: number;
      averagePosition: number;
      averageBacklinks: number;
      topCompetitors: {
        domain: string;
        traffic: number;
        position: number;
        backlinks: number;
      }[];
    };
}
