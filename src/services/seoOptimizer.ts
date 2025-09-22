import {
  ContentOutline,
  ContentPlan,
  CompetitorAnalysis,
  TechnicalSEOAudit,
  KeywordAnalysis,
  ReadabilityMetrics,
  KeywordDistribution,
  InternalLinkPlan,
  ContentLengthRecommendation,
  FAQQuestion,
  CompetitorPageAnalysis,
  KeywordFrequency,
  HeadingPattern,
  ContentGap,
  SEOAuditResult,
  HeadingStructure,
  MetaOptimization,
  LinkAnalysis,
  SEORecommendation,
  ContentStructure,
  HeadingStructureAnalysis,
  MetaElement,
  InternalLinkOpportunity,
  ExternalLinkOpportunity,
  KeywordPlacement
} from '../types/seoAnalysis';

// Mock types for now to avoid compilation errors, replace with actual types later
// For a real app, these would be defined in a separate file, e.g., src/types/factCheck.ts
interface FactCheckReport {
  summary: any;
}

export class SEOOptimizerService {
  private static instance: SEOOptimizerService;

  private constructor() {
    // Private constructor to enforce singleton pattern
  }

  public static getInstance(): SEOOptimizerService {
    if (!SEOOptimizerService.instance) {
      SEOOptimizerService.instance = new SEOOptimizerService();
    }
    return SEOOptimizerService.instance;
  }

  // Core SEO Analysis
  async performSEOAnalysis(text: string, primaryKeyword: string): Promise<any> {
    const keywordAnalysis = this.analyzeKeywords(text, primaryKeyword);
    const readability = this.analyzeReadability(text);
    const structure = this.analyzeContentStructure(text);
    const overallScore = this.calculateOverallScore(keywordAnalysis, readability, structure);
    const recommendations = this.generateRecommendations(keywordAnalysis, readability, structure);

    return {
      overallScore,
      keywordAnalysis,
      readability,
      structure,
      recommendations
    };
  }

  private analyzeKeywords(text: string, primaryKeyword: string): KeywordAnalysis {
    // This is a placeholder. A real implementation would use NLP.
    const words = text.toLowerCase().split(/\s+/);
    const wordCount = words.length;
    const primaryKeywordCount = words.filter(word => word === primaryKeyword.toLowerCase()).length;
    const density = (primaryKeywordCount / wordCount) * 100;

    return {
      primaryKeyword,
      secondaryKeywords: ['keyword2', 'keyword3'], // Mock data
      keywordDensity: [{ keyword: primaryKeyword, count: primaryKeywordCount, density, isTarget: density >= 1 && density <= 3 }],
      lsiKeywords: this.generateLSIKeywords(text), // Calling the new method
      missingKeywords: ['long-tail keyword'] // Mock data
    };
  }

  private analyzeReadability(text: string): ReadabilityMetrics {
    // This is a placeholder. A real implementation would calculate these metrics.
    return {
      fleschScore: 65,
      fleschKincaidGrade: 8,
      sentenceLength: 15,
      paragraphLength: 5,
      passiveVoicePercentage: 8,
      readingTime: Math.round(text.split(/\s+/).length / 200) // 200 wpm
    };
  }

  private analyzeContentStructure(text: string): ContentStructure {
    const headings = text.split('\n').filter(line => line.startsWith('#'));
    return {
      hasHeadings: headings.length > 0,
      headingCount: headings.length,
      hasBulletPoints: text.includes('* ') || text.includes('- '),
      hasNumberedLists: text.match(/^\d+\.\s/m) !== null,
      headingStructure: this.analyzeHeadingStructure(headings)
    };
  }

  private generateRecommendations(keywordAnalysis: KeywordAnalysis, readability: ReadabilityMetrics, structure: ContentStructure): SEORecommendation[] {
    const recommendations = [];
    if (!keywordAnalysis.primaryKeyword) {
      recommendations.push({
        type: 'keyword',
        priority: 'high',
        title: 'Define a primary keyword',
        description: 'Your content lacks a primary keyword, which is essential for targeting search queries.',
        action: 'Add a primary keyword to the content.'
      });
    }
    // More recommendations can be added here
    return recommendations;
  }

  // Content Optimization
  private getAuthorityDomain(source: string): string {
    const domains: { [key: string]: string } = {
      'wikipedia': 'wikipedia.org',
      'government': 'gov',
      'research': 'scholar.google.com',
      'study': 'pubmed.ncbi.nlm.nih.gov',
      'university': 'edu'
    };
    return domains[source.toLowerCase()] || '';
  }

  private analyzeHeadingStructure(headings: string[]): HeadingStructureAnalysis {
    return {
      hasH1: headings.some(h => h.startsWith('# ')),
      hasH2: headings.some(h => h.startsWith('## ')),
      hasH3: headings.some(h => h.startsWith('### ')),
      properHierarchy: this.checkHeadingHierarchy(headings)
    };
  }

  private checkHeadingHierarchy(headings: string[]): boolean {
    const levels = headings.map(h => h.match(/^#+/)?.[0].length || 0);
    let currentLevel = 0;

    for (const level of levels) {
      if (level > currentLevel + 1) return false;
      if (level > 0) {
        currentLevel = level;
      }
    }

    return true;
  }

  private addHeadingStructure(text: string, keywordAnalysis: KeywordAnalysis): string {
    const paragraphs = text.split('\n\n');
    const structuredText = [];

    if (!text.startsWith('#')) {
      const title = keywordAnalysis.primaryKeyword
        ? `# ${keywordAnalysis.primaryKeyword}: ${this.extractTitle(text)}`
        : `# ${this.extractTitle(text)}`;
      structuredText.push(title);
    }

    paragraphs.forEach((paragraph, index) => {
      if (index > 0 && paragraph.length > 200 && !paragraph.startsWith('#')) {
        const firstSentence = paragraph.split('.')[0];
        const subheading = `## ${firstSentence.substring(0, 50)}...`;
        structuredText.push(subheading);
      }
      structuredText.push(paragraph);
    });

    return structuredText.join('\n\n');
  }

  private optimizeKeywordDensity(text: string, keywordAnalysis: KeywordAnalysis): string {
    if (!keywordAnalysis.primaryKeyword) return text;

    const keyword = keywordAnalysis.primaryKeyword;
    const words = text.split(/\s+/);
    const currentDensity = keywordAnalysis.keywordDensity.find(k => k.keyword === keyword)?.density || 0;

    if (currentDensity < 1) {
      const targetAdditions = Math.ceil((words.length * 0.015) - (words.length * currentDensity / 100));
      return this.addKeywordStrategically(text, keyword, targetAdditions);
    }

    return text;
  }

  private addKeywordStrategically(text: string, keyword: string, additions: number): string {
    const paragraphs = text.split('\n\n');
    let additionsLeft = additions;

    if (additionsLeft > 0 && paragraphs.length > 0) {
      paragraphs[0] = this.insertKeywordNaturally(paragraphs[0], keyword);
      additionsLeft--;
    }

    if (additionsLeft > 0 && paragraphs.length > 1) {
      paragraphs[paragraphs.length - 1] = this.insertKeywordNaturally(paragraphs[paragraphs.length - 1], keyword);
      additionsLeft--;
    }

    return paragraphs.join('\n\n');
  }

  private insertKeywordNaturally(paragraph: string, keyword: string): string {
    const sentences = paragraph.split('.');
    if (sentences.length > 1 && !paragraph.toLowerCase().includes(keyword.toLowerCase())) {
      sentences[0] += ` related to ${keyword}`;
    }
    return sentences.join('.');
  }

  private improveReadability(text: string, readability: ReadabilityMetrics): string {
    if (readability.sentenceLength <= 20) return text;

    return text.replace(/([.!?]+)\s+([A-Z])/g, (match, punct, nextChar) => {
      return `${punct} ${nextChar}`;
    });
  }

  private calculateOverallScore(keywordAnalysis: KeywordAnalysis, readability: ReadabilityMetrics, structure: ContentStructure): number {
    let score = 0;

    if (keywordAnalysis.primaryKeyword) score += 15;
    if (keywordAnalysis.keywordDensity.length > 5) score += 10;
    if (keywordAnalysis.lsiKeywords.length > 0) score += 5;

    if (readability.fleschScore > 60) score += 20;
    else if (readability.fleschScore > 30) score += 10;

    if (readability.sentenceLength < 20) score += 10;
    if (readability.passiveVoicePercentage < 10) score += 10;

    if (structure.hasHeadings) score += 15;
    if (structure.hasBulletPoints) score += 5;
    if (structure.headingStructure?.properHierarchy) score += 10;

    return Math.min(100, score);
  }

  // Advanced SEO Features
  async generateContentOutline(topic: string, targetKeywords: string[]): Promise<ContentOutline> {
    return {
      title: this.generateSEOTitle(topic, targetKeywords[0]),
      metaDescription: this.generateSEOMetaDescription(topic, targetKeywords),
      headings: this.generateHeadingStructure(topic, targetKeywords),
      keywordDistribution: this.planKeywordDistribution(targetKeywords),
      internalLinkSuggestions: this.generateInternalLinkPlan(topic),
      contentLength: this.recommendContentLength(topic),
      faqSection: this.generateFAQQuestions(topic)
    };
  }

  async analyzeCompetitorContent(urls: string[]): Promise<CompetitorAnalysis> {
    const analyses = await Promise.all(urls.map(url => this.analyzeCompetitorUrl(url)));

    return {
      averageContentLength: this.calculateAverageLength(analyses),
      commonKeywords: this.extractCommonKeywords(analyses),
      headingPatterns: this.analyzeHeadingPatterns(analyses),
      contentGaps: this.identifyContentGaps(analyses),
      recommendations: this.generateCompetitorRecommendations(analyses)
    };
  }

  generateTechnicalSEOAudit(url: string): TechnicalSEOAudit {
    return {
      pageTitleOptimization: this.auditPageTitle(url),
      metaDescriptionOptimization: this.auditMetaDescription(url),
      headingStructure: this.auditHeadingStructure(url),
      imageOptimization: this.auditImages(url),
      internalLinking: this.auditInternalLinks(url),
      schemaMarkup: this.auditSchemaMarkup(url),
      mobileOptimization: this.auditMobileOptimization(url),
      pageSpeedFactors: this.auditPageSpeed(url)
    };
  }

  // Helper methods for advanced features
  private generateSEOTitle(topic: string, primaryKeyword: string): string {
    const templates = [
      `The Ultimate Guide to ${primaryKeyword}: ${topic}`,
      `${primaryKeyword}: Complete ${topic} Guide for 2024`,
      `How to Master ${primaryKeyword} - ${topic} Explained`,
      `${topic}: Everything You Need to Know About ${primaryKeyword}`
    ];

    return templates[Math.floor(Math.random() * templates.length)];
  }

  private generateSEOMetaDescription(topic: string, keywords: string[]): string {
    const keywordPhrase = keywords.slice(0, 2).join(' and ');
    return `Discover comprehensive insights on ${topic}. Learn about ${keywordPhrase} with expert analysis, practical tips, and actionable strategies. Updated for 2024.`;
  }

  private generateHeadingStructure(topic: string, keywords: string[]): HeadingStructure {
    return {
      h1: `Complete Guide to ${topic}`,
      h2Sections: [
        `What is ${keywords[0]}?`,
        `Why ${keywords[1] || keywords[0]} Matters`,
        `How to Implement ${keywords[0]}`,
        `Best Practices for ${topic}`,
        `Common Mistakes to Avoid`,
        `Future Trends in ${keywords[0]}`
      ],
      h3Subsections: this.generateH3Subsections(keywords)
    };
  }

  private generateH3Subsections(keywords: string[]): { [key: string]: string[] } {
    return {
      [`What is ${keywords[0]}?`]: [
        'Definition and Core Concepts',
        'Historical Context',
        'Current Applications'
      ],
      [`Why ${keywords[1] || keywords[0]} Matters`]: [
        'Business Impact',
        'Industry Benefits',
        'ROI Considerations'
      ],
      [`How to Implement ${keywords[0]}`]: [
        'Step-by-Step Process',
        'Tools and Resources',
        'Implementation Timeline'
      ]
    };
  }

  private planKeywordDistribution(keywords: string[]): KeywordDistribution {
    return {
      primary: {
        keyword: keywords[0],
        targetDensity: 2.5,
        placements: ['title', 'h1', 'first-paragraph', 'last-paragraph', 'meta-description']
      },
      secondary: keywords.slice(1, 4).map(keyword => ({
        keyword,
        targetDensity: 1.5,
        placements: ['h2', 'h3', 'body-paragraphs']
      })),
      lsi: this.generateLSIKeywords(keywords.join(' ')).map(keyword => ({
        keyword,
        targetDensity: 0.5,
        placements: ['body-paragraphs', 'image-alt-text']
      }))
    };
  }

  private generateInternalLinkPlan(topic: string): InternalLinkPlan {
    const relatedTopics = this.getRelatedTopics(topic);

    return {
      contextualLinks: relatedTopics.map(relatedTopic => ({
        anchorText: relatedTopic,
        suggestedUrl: `/topics/${this.slugify(relatedTopic)}`,
        placement: 'contextual-mention',
        relevanceScore: 0.8
      })),
      navigationLinks: [
        {
          anchorText: 'Related Articles',
          suggestedUrl: '/articles/related',
          placement: 'sidebar',
          relevanceScore: 0.6
        }
      ],
      footerLinks: [
        {
          anchorText: `More about ${topic}`,
          suggestedUrl: `/categories/${this.slugify(topic)}`,
          placement: 'footer',
          relevanceScore: 0.4
        }
      ]
    };
  }

  private recommendContentLength(topic: string): ContentLengthRecommendation {
    const topicComplexity = this.assessTopicComplexity(topic);

    return {
      minWords: topicComplexity === 'high' ? 2500 : topicComplexity === 'medium' ? 1500 : 800,
      optimalWords: topicComplexity === 'high' ? 4000 : topicComplexity === 'medium' ? 2500 : 1200,
      maxWords: topicComplexity === 'high' ? 6000 : topicComplexity === 'medium' ? 4000 : 2000,
      reasoning: this.getContentLengthReasoning(topicComplexity)
    };
  }

  private generateFAQQuestions(topic: string): FAQQuestion[] {
    const baseQuestions = [
      `What is ${topic}?`,
      `How does ${topic} work?`,
      `What are the benefits of ${topic}?`,
      `What are the challenges with ${topic}?`,
      `How to get started with ${topic}?`,
      `What are the best practices for ${topic}?`,
      `How much does ${topic} cost?`,
      `What are the alternatives to ${topic}?`
    ];

    return baseQuestions.map(question => ({
      question,
      suggestedAnswer: this.generateFAQAnswer(question, topic),
      searchVolume: this.estimateSearchVolume(question),
      difficulty: this.estimateKeywordDifficulty(question)
    }));
  }

  private async analyzeCompetitorUrl(url: string): Promise<CompetitorPageAnalysis> {
    // This would integrate with web scraping or API services
    return {
      url,
      title: 'Competitor Page Title',
      metaDescription: 'Competitor meta description',
      contentLength: 2500,
      headingCount: 12,
      keywords: ['keyword1', 'keyword2', 'keyword3'],
      internalLinks: 15,
      externalLinks: 8,
      images: 6
    };
  }

  private calculateAverageLength(analyses: CompetitorPageAnalysis[]): number {
    return analyses.reduce((sum, analysis) => sum + analysis.contentLength, 0) / analyses.length;
  }

  private extractCommonKeywords(analyses: CompetitorPageAnalysis[]): KeywordFrequency[] {
    const keywordMap = new Map<string, number>();

    analyses.forEach(analysis => {
      analysis.keywords.forEach(keyword => {
        keywordMap.set(keyword, (keywordMap.get(keyword) || 0) + 1);
      });
    });

    return Array.from(keywordMap.entries())
      .map(([keyword, frequency]) => ({ keyword, frequency }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 20);
  }

  private analyzeHeadingPatterns(analyses: CompetitorPageAnalysis[]): HeadingPattern[] {
    return [
      { pattern: 'Introduction -> Benefits -> How-to -> Conclusion', frequency: 3, effectiveness: 'high' },
      { pattern: 'Definition -> Examples -> Best Practices -> FAQ', frequency: 2, effectiveness: 'medium' }
    ];
  }

  private identifyContentGaps(analyses: CompetitorPageAnalysis[]): ContentGap[] {
    return [
      { topic: 'Advanced Implementation Strategies', opportunity: 'high', reason: 'Most competitors focus on basics only' },
      { topic: 'ROI Calculation Methods', opportunity: 'medium', reason: 'Limited coverage of financial aspects' }
    ];
  }

  private generateCompetitorRecommendations(analyses: CompetitorPageAnalysis[]): string[] {
    const avgLength = this.calculateAverageLength(analyses);

    return [
      `Target content length of ${Math.round(avgLength * 1.2)} words to exceed competitor average`,
      'Include FAQ section as most competitors lack comprehensive Q&A',
      'Add more visual content - competitors average only 6 images',
      'Focus on advanced topics to differentiate from basic competitor content'
    ];
  }

  // Technical SEO Audit Methods
  private auditPageTitle(url: string): SEOAuditResult {
    return {
      status: 'needs-improvement',
      score: 75,
      issues: ['Title too long (68 characters)', 'Missing primary keyword at start'],
      recommendations: ['Shorten to under 60 characters', 'Move primary keyword to beginning']
    };
  }

  private auditMetaDescription(url: string): SEOAuditResult {
    return {
      status: 'good',
      score: 85,
      issues: [],
      recommendations: ['Consider adding call-to-action']
    };
  }

  private auditHeadingStructure(url: string): SEOAuditResult {
    return {
      status: 'needs-improvement',
      score: 70,
      issues: ['Multiple H1 tags found', 'H3 without parent H2'],
      recommendations: ['Use only one H1 per page', 'Fix heading hierarchy']
    };
  }

  private auditImages(url: string): SEOAuditResult {
    return {
      status: 'needs-improvement',
      score: 60,
      issues: ['3 images missing alt text', 'Large file sizes detected'],
      recommendations: ['Add descriptive alt text to all images', 'Optimize images for web']
    };
  }

  private auditInternalLinks(url: string): SEOAuditResult {
    return {
      status: 'good',
      score: 80,
      issues: ['Some links missing descriptive anchor text'],
      recommendations: ['Use keyword-rich anchor text for internal links']
    };
  }

  private auditSchemaMarkup(url: string): SEOAuditResult {
    return {
      status: 'missing',
      score: 0,
      issues: ['No schema markup detected'],
      recommendations: ['Add Article or BlogPosting schema', 'Consider FAQ schema for Q&A content']
    };
  }

  private auditMobileOptimization(url: string): SEOAuditResult {
    return {
      status: 'good',
      score: 90,
      issues: [],
      recommendations: ['Consider improving touch target sizes']
    };
  }

  private auditPageSpeed(url: string): SEOAuditResult {
    return {
      status: 'needs-improvement',
      score: 65,
      issues: ['Largest Contentful Paint: 3.2s', 'Cumulative Layout Shift: 0.15'],
      recommendations: ['Optimize images', 'Minimize JavaScript', 'Improve server response time']
    };
  }

  // Utility methods
  private getRelatedTopics(topic: string): string[] {
    const topicMap: { [key: string]: string[] } = {
      'content marketing': ['SEO', 'social media marketing', 'email marketing', 'content strategy'],
      'fact-checking': ['misinformation', 'media literacy', 'journalism', 'verification'],
      'artificial intelligence': ['machine learning', 'deep learning', 'natural language processing', 'automation']
    };

    return topicMap[topic.toLowerCase()] || ['related topic 1', 'related topic 2'];
  }

  private slugify(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  }

  private assessTopicComplexity(topic: string): 'low' | 'medium' | 'high' {
    const complexTopics = ['artificial intelligence', 'quantum computing', 'blockchain'];
    const simpleTopics = ['social media', 'email marketing', 'basic SEO'];

    if (complexTopics.some(ct => topic.toLowerCase().includes(ct))) return 'high';
    if (simpleTopics.some(st => topic.toLowerCase().includes(st))) return 'low';
    return 'medium';
  }

  private getContentLengthReasoning(complexity: string): string {
    const reasoningMap: { [key: string]: string } = {
      'high': 'Complex topics require comprehensive coverage to establish authority and answer all user questions.',
      'medium': 'Moderate depth needed to cover key points while maintaining reader engagement.',
      'low': 'Concise content preferred for straightforward topics to avoid information overload.'
    };

    return reasoningMap[complexity] || reasoningMap['medium'];
  }

  private generateFAQAnswer(question: string, topic: string): string {
    return `This is a suggested answer for "${question}" related to ${topic}. The answer should be comprehensive yet concise, addressing the core query while incorporating relevant keywords naturally.`;
  }

  private estimateSearchVolume(question: string): number {
    return Math.floor(Math.random() * 10000) + 100;
  }

  private estimateKeywordDifficulty(question: string): 'low' | 'medium' | 'high' {
    const difficulties = ['low', 'medium', 'high'] as const;
    return difficulties[Math.floor(Math.random() * difficulties.length)];
  }

  // New methods to fix the `ContentOptimizer` dependency issue
  private generateLSIKeywords(text: string): string[] {
    // Simple mock implementation
    const stopWords = new Set(['the', 'is', 'in', 'a', 'an', 'and', 'or', 'for', 'to', 'of', 'with', 'about']);
    const words = text.toLowerCase().split(/\s+/).filter(word => !stopWords.has(word) && word.length > 3);
    const wordFrequency = words.reduce((acc: { [key: string]: number }, word: string) => {
      acc[word] = (acc[word] || 0) + 1;
      return acc;
    }, {});

    return Object.keys(wordFrequency).sort((a, b) => wordFrequency[b] - wordFrequency[a]).slice(0, 5);
  }

  private extractTitle(text: string): string {
    const firstSentence = text.split(/[.!?]/)[0];
    return firstSentence.length > 60 ? `${firstSentence.substring(0, 60)}...` : firstSentence;
  }
}
