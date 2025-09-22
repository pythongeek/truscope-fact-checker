import {
  SEOAnalysis,
  KeywordAnalysis,
  ReadabilityMetrics,
  ContentStructure,
  MetaOptimization,
  LinkAnalysis,
  SEORecommendation,
  HeadingStructureAnalysis,
} from '../types/seoAnalysis';

class SEOOptimizerService {
  private primaryKeyword: string = '';
  private secondaryKeywords: string[] = [];

  constructor(primaryKeyword: string, secondaryKeywords: string[] = []) {
    this.primaryKeyword = primaryKeyword;
    this.secondaryKeywords = secondaryKeywords;
  }

  public analyzeContent(text: string): SEOAnalysis {
    const readability = this.calculateReadability(text);
    const structure = this.analyzeStructure(text);
    const keywordAnalysis = this.analyzeKeywords(text);
    const meta = this.optimizeMeta(text);
    const links = this.analyzeLinks(text);
    const recommendations = this.generateRecommendations(keywordAnalysis, readability, structure, meta, links);
    const overallScore = this.calculateOverallScore(recommendations);

    return {
      overallScore,
      keywordAnalysis,
      readability,
      structure,
      schemaMarkup: [], // Placeholder for schema markup suggestions
      metaOptimization: meta,
      linkAnalysis: links,
      recommendations,
    };
  }

  private analyzeKeywords(text: string): KeywordAnalysis {
    const lsiKeywords = this.generateLSIKeywords(text);
    // Placeholder for full keyword analysis
    return {
      primaryKeyword: this.primaryKeyword,
      secondaryKeywords: this.secondaryKeywords,
      keywordDensity: [],
      lsiKeywords,
      missingKeywords: [],
    };
  }

  private calculateReadability(text: string): ReadabilityMetrics {
    // Placeholder for readability calculations
    return {
      fleschScore: 0,
      fleschKincaidGrade: 0,
      sentenceLength: 0,
      paragraphLength: 0,
      passiveVoicePercentage: 0,
      readingTime: 0,
    };
  }

  private analyzeStructure(text: string): ContentStructure {
    const headingStructure = this.addHeadingStructure(text);
    // Placeholder for structure analysis
    return {
      hasHeadings: headingStructure.hasH1 || headingStructure.hasH2,
      headingCount: headingStructure.h1Count + headingStructure.h2Count + headingStructure.h3Count,
      hasBulletPoints: false,
      hasNumberedLists: false,
      headingStructure,
      paragraphCount: 0,
      averageParagraphLength: 0,
      hasIntroduction: text.length > 100,
      hasConclusion: text.length > 200,
      contentFlow: 'good',
    };
  }

  private optimizeMeta(text: string): MetaOptimization {
    const title = this.extractTitle(text);
    // Placeholder for meta optimization
    return {
      title: { current: title, optimized: title, length: title.length, recommendations: [], score: 80, issues: [] },
      description: { current: '', optimized: '', length: 0, recommendations: [], score: 0, issues: ['Missing meta description.'] },
    };
  }

  private analyzeLinks(text: string): LinkAnalysis {
    // Placeholder for link analysis
    return {
      internal: [],
      external: [],
      recommendations: [],
      totalLinks: 0,
      internalLinkRatio: 0,
      externalLinkRatio: 0,
      brokenLinks: [],
      anchorTextAnalysis: {
        overOptimized: false,
        keywordStuffing: false,
        naturalDistribution: true,
        brandedAnchors: 0,
        exactMatchAnchors: 0,
        partialMatchAnchors: 0,
        genericAnchors: 0,
      },
    };
  }

  private generateRecommendations(...analyses: any[]): SEORecommendation[] {
    // Placeholder for recommendation generation
    return [];
  }

  private calculateOverallScore(recommendations: SEORecommendation[]): number {
    // Placeholder for score calculation
    return 85;
  }

  public planKeywordDistribution(text: string): { [key: string]: number } {
    const lsiKeywords = this.generateLSIKeywords(text);
    const distribution: { [key: string]: number } = {
      [this.primaryKeyword]: 5,
      ...this.secondaryKeywords.reduce((acc, kw) => ({ ...acc, [kw]: 2 }), {}),
      ...lsiKeywords.reduce((acc, kw) => ({ ...acc, [kw]: 1 }), {}),
    };
    return distribution;
  }

  public addHeadingStructure(text: string): HeadingStructureAnalysis {
    const title = this.extractTitle(text);
    // A simple logic to add H1 and H2 based on content.
    return {
        hasH1: true,
        h1Count: 1,
        hasH2: text.split('\n\n').length > 2,
        h2Count: text.split('\n\n').length -1,
        hasH3: false,
        h3Count: 0,
        properHierarchy: true,
        headingDistribution: 'balanced'
    }
  }

  private generateLSIKeywords(text: string): string[] {
    const stopwords = new Set(["the", "a", "an", "in", "is", "of", "to", "and", "for", "with", "on", "it", "that", "as", "at", "by", "from", "this", "was", "were", "be", "have", "has", "had", "but", "not", "or", "if", "when", "then", "so", "also", "just", "like"]);
    const allKeywords = new Set([this.primaryKeyword, ...this.secondaryKeywords]);

    const words = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
    const freqMap: { [key: string]: number } = {};

    words.forEach(word => {
      if (word && !stopwords.has(word) && !allKeywords.has(word)) {
        freqMap[word] = (freqMap[word] || 0) + 1;
      }
    });

    const sortedKeywords = Object.keys(freqMap).sort((a, b) => freqMap[b] - freqMap[a]);
    return sortedKeywords.slice(0, 10);
  }

  private extractTitle(text: string): string {
    const firstSentence = text.split(/[.!?]/)[0];
    if (firstSentence.length > 60) {
      return firstSentence.substring(0, 60);
    }
    return firstSentence;
  }
}

export default SEOOptimizerService;
