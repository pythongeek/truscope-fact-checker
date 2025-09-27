export interface SourceCredibilityData {
  domain: string;
  credibilityScore: number; // 0-100
  biasRating: 'left' | 'lean-left' | 'center' | 'lean-right' | 'right' | 'unknown';
  factualReporting: 'very-high' | 'high' | 'mixed' | 'low' | 'very-low';
  category: 'academic' | 'news' | 'government' | 'ngo' | 'corporate' | 'social' | 'blog';
  lastUpdated: Date;
  verificationStatus: 'verified' | 'unverified' | 'flagged';
  notes?: string;
}

export class SourceCredibilityService {
  private static instance: SourceCredibilityService;
  private credibilityDatabase: Map<string, SourceCredibilityData>;

  static getInstance(): SourceCredibilityService {
    if (!SourceCredibilityService.instance) {
      SourceCredibilityService.instance = new SourceCredibilityService();
    }
    return SourceCredibilityService.instance;
  }

  constructor() {
    this.credibilityDatabase = new Map();
    this.initializeDatabase();
  }

  private initializeDatabase(): void {
    // High-credibility academic and news sources
    const highCredibilitySources: Partial<SourceCredibilityData>[] = [
      { domain: 'nature.com', credibilityScore: 95, biasRating: 'center', factualReporting: 'very-high', category: 'academic' },
      { domain: 'science.org', credibilityScore: 95, biasRating: 'center', factualReporting: 'very-high', category: 'academic' },
      { domain: 'nejm.org', credibilityScore: 95, biasRating: 'center', factualReporting: 'very-high', category: 'academic' },
      { domain: 'reuters.com', credibilityScore: 90, biasRating: 'center', factualReporting: 'very-high', category: 'news' },
      { domain: 'apnews.com', credibilityScore: 90, biasRating: 'center', factualReporting: 'very-high', category: 'news' },
      { domain: 'bbc.com', credibilityScore: 88, biasRating: 'center', factualReporting: 'high', category: 'news' },
      { domain: 'npr.org', credibilityScore: 85, biasRating: 'lean-left', factualReporting: 'high', category: 'news' },
      { domain: 'cdc.gov', credibilityScore: 92, biasRating: 'center', factualReporting: 'very-high', category: 'government' },
      { domain: 'who.int', credibilityScore: 90, biasRating: 'center', factualReporting: 'high', category: 'government' },
      { domain: 'nasa.gov', credibilityScore: 93, biasRating: 'center', factualReporting: 'very-high', category: 'government' },
    ];

    // Medium credibility sources
    const mediumCredibilitySources: Partial<SourceCredibilityData>[] = [
      { domain: 'cnn.com', credibilityScore: 70, biasRating: 'lean-left', factualReporting: 'mixed', category: 'news' },
      { domain: 'foxnews.com', credibilityScore: 65, biasRating: 'lean-right', factualReporting: 'mixed', category: 'news' },
      { domain: 'forbes.com', credibilityScore: 75, biasRating: 'lean-right', factualReporting: 'high', category: 'news' },
      { domain: 'wikipedia.org', credibilityScore: 70, biasRating: 'center', factualReporting: 'mixed', category: 'social' },
      { domain: 'washingtonpost.com', credibilityScore: 78, biasRating: 'lean-left', factualReporting: 'high', category: 'news' },
      { domain: 'wsj.com', credibilityScore: 80, biasRating: 'lean-right', factualReporting: 'high', category: 'news' },
    ];

    // Low credibility / flagged sources
    const lowCredibilitySources: Partial<SourceCredibilityData>[] = [
      { domain: 'infowars.com', credibilityScore: 15, biasRating: 'right', factualReporting: 'very-low', category: 'blog', verificationStatus: 'flagged' },
      { domain: 'dailymail.co.uk', credibilityScore: 45, biasRating: 'lean-right', factualReporting: 'mixed', category: 'news' },
      { domain: 'buzzfeed.com', credibilityScore: 50, biasRating: 'lean-left', factualReporting: 'mixed', category: 'news' },
    ];

    // Combine and add to database
    [...highCredibilitySources, ...mediumCredibilitySources, ...lowCredibilitySources].forEach(source => {
      const fullSource: SourceCredibilityData = {
        domain: source.domain!,
        credibilityScore: source.credibilityScore!,
        biasRating: source.biasRating || 'unknown',
        factualReporting: source.factualReporting!,
        category: source.category!,
        lastUpdated: new Date(),
        verificationStatus: source.verificationStatus || 'verified'
      };
      this.credibilityDatabase.set(source.domain!, fullSource);
    });
  }

  async analyzeSource(url: string): Promise<SourceCredibilityData> {
    try {
      const domain = new URL(url).hostname.replace('www.', '');

      // Check if we have data for this domain
      const knownSource = this.credibilityDatabase.get(domain);
      if (knownSource) {
        return knownSource;
      }

      // For unknown sources, return default analysis
      return this.analyzeUnknownSource(domain, url);
    } catch (error) {
      // Handle invalid URLs
      return {
        domain: 'unknown',
        credibilityScore: 30,
        biasRating: 'unknown',
        factualReporting: 'mixed',
        category: 'social' as any,
        lastUpdated: new Date(),
        verificationStatus: 'unverified',
        notes: 'Invalid URL or domain'
      };
    }
  }

  private analyzeUnknownSource(domain: string, url: string): SourceCredibilityData {
    let credibilityScore = 40; // Default for unknown
    let category: SourceCredibilityData['category'] = 'blog';

    // Heuristic analysis based on domain characteristics
    if (domain.endsWith('.edu')) {
      credibilityScore = 85;
      category = 'academic';
    } else if (domain.endsWith('.gov')) {
      credibilityScore = 88;
      category = 'government';
    } else if (domain.endsWith('.org')) {
      credibilityScore = 65;
      category = 'ngo';
    } else if (domain.includes('university') || domain.includes('college')) {
      credibilityScore = 80;
      category = 'academic';
    } else if (domain.includes('news') || domain.includes('times') || domain.includes('post')) {
      credibilityScore = 60;
      category = 'news';
    }

    return {
      domain,
      credibilityScore,
      biasRating: 'unknown',
      factualReporting: 'mixed',
      category,
      lastUpdated: new Date(),
      verificationStatus: 'unverified',
      notes: 'Analyzed heuristically - manual verification recommended'
    };
  }

  calculateWeightedScore(sources: Array<{url?: string, score: number}>): number {
    if (sources.length === 0) return 0;

    let totalWeight = 0;
    let weightedSum = 0;

    sources.forEach(source => {
      if (source.url) {
        try {
          const credibility = this.credibilityDatabase.get(new URL(source.url).hostname.replace('www.', ''));
          const weight = credibility ? credibility.credibilityScore / 100 : 0.4;
          totalWeight += weight;
          weightedSum += source.score * weight;
        } catch (error) {
          // Invalid URL, use default weight
          totalWeight += 0.4;
          weightedSum += source.score * 0.4;
        }
      } else {
        // No URL provided, use default weight
        totalWeight += 0.5;
        weightedSum += source.score * 0.5;
      }
    });

    return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
  }

  getBiasWarnings(sources: Array<{url?: string}>): string[] {
    const biasCount = { left: 0, right: 0, center: 0, unknown: 0 };
    const warnings: string[] = [];

    sources.forEach(source => {
      if (source.url) {
        try {
          const credibility = this.credibilityDatabase.get(new URL(source.url).hostname.replace('www.', ''));
          if (credibility) {
            if (credibility.biasRating.includes('left')) biasCount.left++;
            else if (credibility.biasRating.includes('right')) biasCount.right++;
            else if (credibility.biasRating === 'center') biasCount.center++;
            else biasCount.unknown++;
          }
        } catch (error) {
          biasCount.unknown++;
        }
      }
    });

    const total = sources.length;
    if (total > 0) {
      if ((biasCount.left / total) > 0.7) {
        warnings.push('Analysis may be influenced by left-leaning sources');
      }
      if ((biasCount.right / total) > 0.7) {
        warnings.push('Analysis may be influenced by right-leaning sources');
      }
      if ((biasCount.unknown / total) > 0.5) {
        warnings.push('Many sources have unknown political bias - exercise caution');
      }
    }

    return warnings;
  }
}