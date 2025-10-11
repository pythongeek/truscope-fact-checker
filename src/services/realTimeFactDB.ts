import { FactCheckReport, FactVerdict } from '@/types';
import { FactDatabase, VerifiedSource } from '@/types/factDatabase';
import { BlobStorageService } from './blobStorage';

export class RealTimeFactDBService {
  private static instance: RealTimeFactDBService;
  private factCache: Map<string, FactDatabase> = new Map();
  private blobStorage: BlobStorageService;
  private isInitialized = false;
  private isInitializing = false;

  constructor() {
    this.blobStorage = BlobStorageService.getInstance();
  }

  static getInstance(): RealTimeFactDBService {
    if (!RealTimeFactDBService.instance) {
      RealTimeFactDBService.instance = new RealTimeFactDBService();
    }
    return RealTimeFactDBService.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized || this.isInitializing) return;

    this.isInitializing = true;

    try {
      const facts = await this.blobStorage.loadFactDatabase();
      facts.forEach(fact => {
        this.factCache.set(this.normalizeStatement(fact.statement), fact);
      });
      this.isInitialized = true;
      console.log(`Loaded ${facts.length} facts into cache`);
    } catch (error) {
      console.error('Failed to initialize fact database:', error);
      this.isInitialized = true; // Continue with empty cache
    } finally {
      this.isInitializing = false;
    }
  }

  async saveFact(fact: FactDatabase): Promise<void> {
    const normalizedKey = this.normalizeStatement(fact.statement);
    this.factCache.set(normalizedKey, fact);

    // Save to blob storage periodically or on important updates
    await this.persistToStorage();
  }

  async getFact(statement: string): Promise<FactDatabase | null> {
    await this.ensureInitialized();

    const normalizedStatement = this.normalizeStatement(statement);

    // Direct match
    if (this.factCache.has(normalizedStatement)) {
      return this.factCache.get(normalizedStatement)!;
    }

    // Fuzzy matching for similar statements
    const similarFact = this.findSimilarFact(normalizedStatement);
    if (similarFact && this.calculateSimilarity(normalizedStatement, similarFact.normalizedStatement) > 0.8) {
      return similarFact;
    }

    return null;
  }

  async updateFact(id: string, updates: Partial<FactDatabase>): Promise<void> {
    const fact = Array.from(this.factCache.values()).find(f => f.id === id);
    if (!fact) {
      throw new Error(`Fact with id ${id} not found`);
    }

    const updatedFact: FactDatabase = {
      ...fact,
      ...updates,
      verification: {
        ...fact.verification,
        lastVerified: new Date(),
        verificationCount: fact.verification.verificationCount + 1
      }
    };

    await this.saveFact(updatedFact);
  }

  async searchFacts(query: string, limit: number = 10): Promise<FactDatabase[]> {
    await this.ensureInitialized();

    const normalizedQuery = this.normalizeStatement(query);
    const results: Array<{fact: FactDatabase, score: number}> = [];

    this.factCache.forEach(fact => {
      const similarity = this.calculateSimilarity(normalizedQuery, fact.normalizedStatement);
      if (similarity > 0.3) {
        results.push({ fact, score: similarity });
      }
    });

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(r => r.fact);
  }

  async addFactFromReport(statement: string, report: FactCheckReport): Promise<FactDatabase> {
    const fact: FactDatabase = {
      id: this.generateId(),
      statement,
      normalizedStatement: this.normalizeStatement(statement),
      verdict: this.mapScoreToVerdict(report.final_score),
      confidence: report.final_score / 100,
      sources: report.evidence.map(evidence => ({
        url: evidence.url || '',
        publisher: evidence.publisher,
        credibilityScore: evidence.score,
        publicationDate: new Date(), // Would need to extract from evidence
        relevanceScore: 0.8, // Default relevance
        quote: evidence.quote,
        sourceType: this.determineSourceType(evidence.publisher)
      })),
      metadata: {
        topic: this.extractTopic(statement),
        category: this.extractCategories(statement),
        timeRelevance: 'current',
        complexity: this.assessComplexity(statement)
      },
      verification: {
        lastVerified: new Date(),
        verificationCount: 1,
        automaticReverification: true,
        nextVerificationDue: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        verificationHistory: [{
          date: new Date(),
          method: report.metadata.method_used,
          confidence: report.final_score / 100,
          source: 'AI Analysis'
        }]
      },
      trends: {
        trendingScore: 0,
        mentionCount: 0,
        platforms: [],
        declineRate: 0
      }
    };

    await this.saveFact(fact);
    return fact;
  }

  async getTrendingMisinformation(limit: number = 20): Promise<FactDatabase[]> {
    await this.ensureInitialized();

    return Array.from(this.factCache.values())
      .filter(fact => fact.verdict === 'false' || fact.verdict === 'mostly-false')
      .sort((a, b) => b.trends.trendingScore - a.trends.trendingScore)
      .slice(0, limit);
  }

  async getFactsNeedingReverification(): Promise<FactDatabase[]> {
    await this.ensureInitialized();

    const now = new Date();
    return Array.from(this.factCache.values())
      .filter(fact =>
        fact.verification.automaticReverification &&
        fact.verification.nextVerificationDue <= now
      );
  }

  private async ensureInitialized(): Promise<void> {
    while (this.isInitializing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  private async persistToStorage(): Promise<void> {
    try {
      const facts = Array.from(this.factCache.values());
      await this.blobStorage.saveFactDatabase(facts);
    } catch (error) {
      console.error('Failed to persist fact database:', error);
    }
  }

  private normalizeStatement(statement: string): string {
    return statement
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  private findSimilarFact(normalizedStatement: string): FactDatabase | null {
    let bestMatch: FactDatabase | null = null;
    let bestScore = 0;

    this.factCache.forEach(fact => {
      const score = this.calculateSimilarity(normalizedStatement, fact.normalizedStatement);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = fact;
      }
    });

    return bestScore > 0.7 ? bestMatch : null;
  }

  private calculateSimilarity(str1: string, str2: string): number {
    // Simple Jaccard similarity - you might want to use a more sophisticated algorithm
    const set1 = new Set(str1.split(' '));
    const set2 = new Set(str2.split(' '));

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  private mapScoreToVerdict(score: number): FactVerdict {
    if (score >= 90) return 'true';
    if (score >= 70) return 'mostly-true';
    if (score >= 40) return 'mixed';
    if (score >= 20) return 'mostly-false';
    return 'false';
  }

  private determineSourceType(publisher: string): VerifiedSource['sourceType'] {
    const academicDomains = ['edu', 'arxiv', 'pubmed', 'scholar'];
    const newsDomains = ['news', 'times', 'post', 'guardian', 'reuters', 'ap'];
    const govDomains = ['gov', 'mil'];

    const lowerPublisher = publisher.toLowerCase();

    if (academicDomains.some(domain => lowerPublisher.includes(domain))) {
      return 'academic';
    }
    if (newsDomains.some(domain => lowerPublisher.includes(domain))) {
      return 'news';
    }
    if (govDomains.some(domain => lowerPublisher.includes(domain))) {
      return 'government';
    }

    return 'organization';
  }

  private extractTopic(statement: string): string {
    // Simple topic extraction - you might want to use NLP libraries
    const words = statement.toLowerCase().split(' ');
    const commonTopics = {
      'climate': ['climate', 'global', 'warming', 'temperature', 'carbon'],
      'health': ['health', 'medical', 'disease', 'vaccine', 'treatment'],
      'politics': ['election', 'vote', 'government', 'policy', 'president'],
      'technology': ['ai', 'computer', 'internet', 'software', 'tech'],
      'economy': ['economy', 'market', 'money', 'financial', 'economic']
    };

    for (const [topic, keywords] of Object.entries(commonTopics)) {
      if (keywords.some(keyword => words.includes(keyword))) {
        return topic;
      }
    }

    return 'general';
  }

  private extractCategories(statement: string): string[] {
    const categories: string[] = [];
    const lowerStatement = statement.toLowerCase();

    const categoryKeywords = {
      'science': ['study', 'research', 'scientist', 'data', 'evidence'],
      'politics': ['government', 'policy', 'election', 'political', 'congress'],
      'health': ['health', 'medical', 'doctor', 'hospital', 'treatment'],
      'environment': ['environment', 'climate', 'pollution', 'green', 'sustainable'],
      'technology': ['technology', 'digital', 'internet', 'computer', 'ai'],
      'economics': ['economic', 'financial', 'market', 'business', 'trade']
    };

    Object.entries(categoryKeywords).forEach(([category, keywords]) => {
      if (keywords.some(keyword => lowerStatement.includes(keyword))) {
        categories.push(category);
      }
    });

    return categories.length > 0 ? categories : ['general'];
  }

  private assessComplexity(statement: string): 'simple' | 'complex' | 'expert-level' {
    const wordCount = statement.split(' ').length;
    const complexWords = ['however', 'therefore', 'consequently', 'furthermore', 'nevertheless'];
    const technicalTerms = ['algorithm', 'hypothesis', 'methodology', 'statistical', 'correlation'];

    const hasComplexWords = complexWords.some(word => statement.toLowerCase().includes(word));
    const hasTechnicalTerms = technicalTerms.some(term => statement.toLowerCase().includes(term));

    if (hasTechnicalTerms || wordCount > 50) return 'expert-level';
    if (hasComplexWords || wordCount > 25) return 'complex';
    return 'simple';
  }

  private generateId(): string {
    return 'fact_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}