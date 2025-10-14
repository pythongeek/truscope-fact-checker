// api/fact-check.ts - FULLY FIXED VERSION
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Vercel timeout configuration
export const config = {
  maxDuration: 10, // Maximum for Hobby tier
};

// --- CONSTANTS ---
const GOOGLE_FACT_CHECK_URL = 'https://factchecktools.googleapis.com/v1alpha1/claims:search';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const SERPER_API_URL = 'https://google.serper.dev/search';
const WEBZ_API_URL = 'https://api.webz.io/newsApiLite';

// Timeout for individual API calls (in milliseconds)
const API_TIMEOUT = 4000;
const PHASE_TIMEOUT = 8000;

// --- INLINE TYPE DEFINITIONS ---
type FactVerdict = 'TRUE' | 'FALSE' | 'MIXED' | 'UNVERIFIED' | 'MISLEADING';

interface Evidence {
  id: string;
  url: string;
  title: string;
  snippet: string;
  publisher: string;
  publicationDate?: string;
  credibilityScore: number;
  relevanceScore: number;
  type: 'claim' | 'news' | 'search_result' | 'official_source';
  source: {
    name: string;
    url: string;
    credibility: {
      rating: 'High' | 'Medium' | 'Low';
      classification: string;
      warnings: string[];
    };
  };
  quote: string;
  score: number;
  publishedDate?: string;
}

interface TierBreakdown {
  tier: string;
  success: boolean;
  confidence: number;
  evidence: Evidence[];
  processingTime: number;
  escalationReason?: string;
}

interface FactCheckReport {
  id: string;
  originalText: string;
  finalVerdict: FactVerdict;
  finalScore: number;
  reasoning: string;
  evidence: Evidence[];
  claimVerifications: any[];
  scoreBreakdown: {
    finalScoreFormula: string;
    metrics: Array<{
      name: string;
      score: number;
      weight: number;
      description: string;
      reasoning: string;
    }>;
  };
  metadata: {
    methodUsed: string;
    processingTimeMs: number;
    apisUsed: string[];
    sourcesConsulted: {
      total: number;
      highCredibility: number;
      conflicting: number;
    };
    warnings: string[];
    tierBreakdown: Array<{
      tier: string;
      success: boolean;
      confidence: number;
      processingTimeMs: number;
      evidenceCount: number;
    }>;
  };
}

// --- LOGGER ---
const logger = {
  info: (msg: string, meta?: any) => console.log(JSON.stringify({ level: 'INFO', message: msg, ...meta })),
  warn: (msg: string, meta?: any) => console.warn(JSON.stringify({ level: 'WARN', message: msg, ...meta })),
  error: (msg: string, meta?: any) => console.error(JSON.stringify({ level: 'ERROR', message: msg, ...meta }))
};

// --- FETCH WITH TIMEOUT ---
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}

// --- GEMINI API ---
async function callGeminiAPI(prompt: string, apiKey: string, model: string = 'gemini-2.0-flash-exp'): Promise<string> {
  try {
    const url = `${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`;
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1024
        }
      })
    }, API_TIMEOUT);

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error('Gemini API HTTP error', { status: response.status, body: errorBody });
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } catch (error: any) {
    logger.error('Gemini API call failed', { errorMessage: error.message });
    throw error;
  }
}

// --- MAIN HANDLER ---
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    logger.warn('Method not allowed', { method: req.method });
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const startTime = Date.now();
  const { text, publishingContext = 'journalism', config = {}, clientSideResults = {} } = req.body;

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    logger.warn('Validation failed: Text is required');
    return res.status(400).json({ error: 'Text is required for fact-checking.' });
  }

  logger.info('Starting Tiered Fact-Check', { textLength: text.length, context: publishingContext });

  try {
    // Run phases sequentially with timeouts
    const phase1Result = await runWithTimeout(() => runPhase1ClientSide(text, config, clientSideResults.phase1), PHASE_TIMEOUT, 'Phase 1');
    const phase2Result = await runWithTimeout(() => runPhase2Direct(text, config), PHASE_TIMEOUT, 'Phase 2');
    const phase3Result = await runWithTimeout(() => runPhase3Direct(text, config), PHASE_TIMEOUT, 'Phase 3');

    const tierResults = [phase1Result, phase2Result, phase3Result];
    const allEvidence = deduplicateEvidence([
      ...phase1Result.evidence,
      ...phase2Result.evidence,
      ...phase3Result.evidence
    ]);

    logger.info(`Total unique evidence collected: ${allEvidence.length}`);

    const validatedEvidence = await validateCitations(allEvidence);

    const finalReport = await runPhase4Synthesis(
      text,
      validatedEvidence,
      publishingContext,
      tierResults,
      startTime,
      config
    );

    logger.info('Fact-Check Complete', { 
      finalScore: finalReport.finalScore, 
      verdict: finalReport.finalVerdict,
      evidenceCount: allEvidence.length 
    });
    
    return res.status(200).json(finalReport);

  } catch (error: any) {
    logger.error('Unhandled error in fact-check handler', { errorMessage: error.message, stack: error.stack });
    return res.status(500).json({
      error: 'A server error has occurred.',
      details: error.message,
    });
  }
}

// --- TIMEOUT WRAPPER ---
async function runWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  phaseName: string
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${phaseName} timeout after ${timeoutMs}ms`)), timeoutMs)
    )
  ]).catch(error => {
    logger.warn(`${phaseName} failed or timed out`, { error: error.message });
    return createFailedPhase(phaseName.toLowerCase().replace(' ', '-'), error) as T;
  });
}

// Helper to create failed phase result
function createFailedPhase(tier: string, reason: any): TierBreakdown {
  return {
    tier,
    success: false,
    confidence: 0,
    evidence: [],
    processingTime: 0,
    escalationReason: reason?.message || String(reason)
  };
}

// --- PHASE 1: GOOGLE FACT CHECK (CLIENT-SIDE ONLY) ---
// This phase is handled client-side, so we skip it on the server
async function runPhase1ClientSide(text: string, config: any, clientResult?: TierBreakdown): Promise<TierBreakdown> {
    const startTime = Date.now();

    if (clientResult && clientResult.success) {
        logger.info('Phase 1: Using client-side Google Fact Check results');
        return {
            ...clientResult,
            tier: 'direct-verification',
            processingTime: (Date.now() - startTime) + (clientResult.processingTime || 0),
        };
    }

    logger.info('Phase 1: No client-side results provided, skipping server-side execution');

    return {
        tier: 'direct-verification',
        success: false,
        confidence: 0,
        evidence: [],
        processingTime: Date.now() - startTime,
        escalationReason: 'Google Fact Check API is client-side only and no results were provided'
    };
}

// --- PHASE 2: SERPER SEARCH ---
async function runPhase2Direct(text: string, config: any): Promise<TierBreakdown> {
  const startTime = Date.now();
  try {
    const query = extractSmartQuery(text, 100);
    const apiKey = process.env.SERP_API_KEY;

    if (!apiKey) {
      throw new Error('SERP API key not configured');
    }

    logger.info('Phase 2: Starting SERP search', { query: query.substring(0, 50) });

    const response = await fetchWithTimeout(SERPER_API_URL, {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query }),
    }, API_TIMEOUT);

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error('SERP API HTTP error', { status: response.status, body: errorBody });
      throw new Error(`SERP API error: ${response.status}`);
    }

    const data = await response.json();
    const evidence = mapSerpResultsToEvidence(data.organic || [], data.knowledgeGraph);

    // Calculate confidence based on evidence quality and quantity
    const confidence = calculateTierConfidence(evidence);
    
    logger.info(`Phase 2: Found ${evidence.length} SERP results`, { 
      confidence: confidence.toFixed(1),
      highCredSources: evidence.filter(e => e.credibilityScore >= 80).length
    });

    return {
      tier: 'web-search',
      success: evidence.length > 0,
      confidence,
      evidence,
      processingTime: Date.now() - startTime
    };
  } catch (error: any) {
    logger.warn('Phase 2 failed', { errorMessage: error.message });
    return {
      tier: 'web-search',
      success: false,
      confidence: 0,
      evidence: [],
      processingTime: Date.now() - startTime,
      escalationReason: error.message
    };
  }
}

// --- PHASE 3: WEBZ NEWS ---
async function runPhase3Direct(text: string, config: any): Promise<TierBreakdown> {
  const startTime = Date.now();
  try {
    const entities = extractKeyEntities(text);
    const query = entities.length > 0 ? entities.slice(0, 3).join(' ') : extractSmartQuery(text, 50);
    
    logger.info('Phase 3: Starting news search', { query, entities });

    const apiKey = process.env.WEBZ_API_KEY;

    if (!apiKey) {
      throw new Error('Webz API key not configured');
    }

    const params = new URLSearchParams({
      token: apiKey,
      q: query,
      size: '15',
      sort: 'relevancy',
      ts: getRecentDate()
    });

    const url = `${WEBZ_API_URL}?${params.toString()}`;
    const response = await fetchWithTimeout(url, { method: 'GET' }, API_TIMEOUT);

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error('Webz API HTTP error', { status: response.status, body: errorBody });
      throw new Error(`Webz API error: ${response.status}`);
    }

    const data = await response.json();
    const evidence = mapNewsResultsToEvidence(data.posts || []);

    // Calculate confidence based on news source quality
    const confidence = calculateTierConfidence(evidence);
    
    logger.info(`Phase 3: Found ${evidence.length} news results`, { 
      confidence: confidence.toFixed(1),
      highCredSources: evidence.filter(e => e.credibilityScore >= 80).length
    });

    return {
      tier: 'news-analysis',
      success: evidence.length > 0,
      confidence,
      evidence,
      processingTime: Date.now() - startTime
    };
  } catch (error: any) {
    logger.warn('Phase 3 failed', { errorMessage: error.message });
    return {
      tier: 'news-analysis',
      success: false,
      confidence: 0,
      evidence: [],
      processingTime: Date.now() - startTime,
      escalationReason: error.message
    };
  }
}

// --- CALCULATE TIER CONFIDENCE ---
function calculateTierConfidence(evidence: Evidence[]): number {
  if (evidence.length === 0) return 0;
  
  // Weight by credibility score and number of sources
  const avgCredibility = evidence.reduce((sum, e) => sum + e.credibilityScore, 0) / evidence.length;
  
  // High credibility sources (>=80) boost confidence
  const highCredCount = evidence.filter(e => e.credibilityScore >= 80).length;
  const highCredBonus = Math.min(20, highCredCount * 4); // Max 20% bonus
  
  // Multiple sources increase confidence
  const volumeBonus = Math.min(10, evidence.length * 2); // Max 10% bonus
  
  return Math.min(100, avgCredibility + highCredBonus + volumeBonus);
}

// --- EVIDENCE MAPPERS ---
function mapSerpResultsToEvidence(results: any[] = [], knowledgeGraph?: any): Evidence[] {
  const evidence: Evidence[] = [];
  
  // Add knowledge graph as high-credibility source if available
  if (knowledgeGraph?.description) {
    evidence.push({
      id: `serp_kg_${Date.now()}`,
      quote: knowledgeGraph.description,
      title: knowledgeGraph.title || 'Knowledge Graph',
      snippet: knowledgeGraph.description,
      publisher: 'Google Knowledge Graph',
      url: knowledgeGraph.website || knowledgeGraph.descriptionLink || 'https://google.com',
      score: 90,
      credibilityScore: 90,
      relevanceScore: 95,
      publicationDate: new Date().toISOString(),
      publishedDate: new Date().toISOString(),
      type: 'official_source' as const,
      source: {
        name: 'Google Knowledge Graph',
        url: 'https://google.com',
        credibility: {
          rating: 'High',
          classification: 'Knowledge Graph',
          warnings: []
        }
      }
    });
  }
  
  // Map regular search results
  const mappedResults = results.slice(0, 10).map((result: any, index: number): Evidence | null => {
    if (!result.link) return null;
    
    const domain = extractDomain(result.link);
    const credScore = calculateSourceScore(domain);
    
    // Extract better publication date
    const pubDate = result.date || result.datePublished || extractDateFromSnippet(result.snippet);

    return {
      id: `serp_${Date.now()}_${index}`,
      quote: result.snippet || result.description || '',
      title: result.title || 'Search Result',
      snippet: result.snippet || result.description || '',
      publisher: result.source || domain,
      url: result.link,
      score: credScore,
      credibilityScore: credScore,
      relevanceScore: calculateRelevanceScore(result.position, result.snippet),
      publicationDate: pubDate,
      publishedDate: pubDate,
      type: 'search_result' as const,
      source: {
        name: result.source || domain,
        url: result.link,
        credibility: {
          rating: credScore >= 80 ? 'High' : credScore >= 60 ? 'Medium' : 'Low',
          classification: classifySource(domain),
          warnings: getSourceWarnings(domain, credScore)
        }
      }
    };
  }).filter((e): e is Evidence => e !== null);
  
  return [...evidence, ...mappedResults];
}

function mapNewsResultsToEvidence(posts: any[] = []): Evidence[] {
  return posts.slice(0, 10).map((post: any, index: number): Evidence | null => {
    if (!post.url) return null;
    
    const domain = extractDomain(post.url);
    const publisher = post.thread?.site_full || post.thread?.site || post.author || domain;
    const credScore = calculateNewsSourceScore(domain, post);

    return {
      id: `news_${Date.now()}_${index}`,
      quote: post.text?.substring(0, 300) || post.title || '',
      title: post.title || 'News Article',
      snippet: post.text?.substring(0, 250) || '',
      publisher,
      url: post.url,
      score: credScore,
      credibilityScore: credScore,
      relevanceScore: 80,
      publicationDate: post.published || post.thread?.published,
      publishedDate: post.published || post.thread?.published,
      type: 'news' as const,
      source: {
        name: publisher,
        url: post.url,
        credibility: {
          rating: credScore >= 80 ? 'High' : credScore >= 60 ? 'Medium' : 'Low',
          classification: 'News Publication',
          warnings: getSourceWarnings(domain, credScore)
        }
      }
    };
  }).filter((e): e is Evidence => e !== null);
}

// --- ENHANCED SOURCE SCORING ---
function calculateNewsSourceScore(domain: string, post: any): number {
  const baseScore = calculateSourceScore(domain);
  
  // Boost for recent articles
  if (post.published) {
    const daysOld = (Date.now() - new Date(post.published).getTime()) / (1000 * 60 * 60 * 24);
    if (daysOld < 7) return Math.min(100, baseScore + 5);
    if (daysOld < 30) return Math.min(100, baseScore + 3);
  }
  
  // Boost for articles with authors
  if (post.author && post.author !== 'Unknown') {
    return Math.min(100, baseScore + 2);
  }
  
  return baseScore;
}

function calculateSourceScore(domain: string): number {
  const d = domain.toLowerCase();
  
  // Tier 1: Premier news agencies (95-98)
  if (['reuters.com', 'apnews.com', 'ap.org'].some(s => d.includes(s))) return 98;
  if (['bbc.com', 'bbc.co.uk'].some(s => d.includes(s))) return 95;
  if (['pbs.org', 'npr.org'].some(s => d.includes(s))) return 94;
  
  // Tier 2: Fact-checking organizations (90-93)
  if (['factcheck.org', 'snopes.com', 'politifact.com', 'fullfact.org'].some(s => d.includes(s))) return 92;
  
  // Tier 3: Major newspapers (85-90)
  if (['nytimes.com', 'washingtonpost.com', 'wsj.com', 'ft.com'].some(s => d.includes(s))) return 88;
  if (['theguardian.com', 'telegraph.co.uk', 'economist.com'].some(s => d.includes(s))) return 87;
  
  // Tier 4: Government and academic (85-95)
  if (d.includes('.gov')) return 90;
  if (d.includes('.edu')) return 85;
  if (d.includes('who.int') || d.includes('un.org')) return 93;
  
  // Tier 5: Major networks (75-82)
  if (['cnn.com', 'cbsnews.com', 'nbcnews.com', 'abcnews.go.com'].some(s => d.includes(s))) return 78;
  if (['aljazeera.com', 'dw.com', 'france24.com'].some(s => d.includes(s))) return 76;
  
  // Tier 6: Tech/Business news (70-80)
  if (['techcrunch.com', 'wired.com', 'arstechnica.com', 'theverge.com'].some(s => d.includes(s))) return 75;
  if (['bloomberg.com', 'forbes.com', 'fortune.com'].some(s => d.includes(s))) return 74;
  
  // Tier 7: Science sources (75-85)
  if (['nature.com', 'science.org', 'scientificamerican.com'].some(s => d.includes(s))) return 85;
  if (d.includes('pubmed') || d.includes('nih.gov')) return 90;
  
  // Default for unknown sources
  return 60;
}

// --- HELPER FUNCTIONS ---
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return url.split('/')[2]?.replace('www.', '') || url;
  }
}

function classifySource(domain: string): string {
  const d = domain.toLowerCase();
  if (d.includes('.gov')) return 'Government Source';
  if (d.includes('.edu')) return 'Academic Institution';
  if (['reuters', 'apnews', 'bbc', 'pbs', 'npr'].some(s => d.includes(s))) return 'News Agency';
  if (['factcheck', 'snopes', 'politifact'].some(s => d.includes(s))) return 'Fact Checking Organization';
  if (['nytimes', 'washingtonpost', 'wsj', 'guardian'].some(s => d.includes(s))) return 'Major Newspaper';
  if (['cnn', 'cbs', 'nbc', 'abc'].some(s => d.includes(s))) return 'News Network';
  return 'Web Source';
}

function getSourceWarnings(domain: string, score: number): string[] {
  const warnings: string[] = [];
  if (score < 60) warnings.push('Low credibility source');
  if (domain.includes('blog')) warnings.push('Blog or opinion site');
  if (!domain.includes('https')) warnings.push('Non-secure connection');
  return warnings;
}

function calculateRelevanceScore(position?: number, snippet?: string): number {
  let score = 75;
  if (position && position <= 3) score += 15;
  else if (position && position <= 5) score += 10;
  else if (position && position <= 10) score += 5;
  
  if (snippet && snippet.length > 150) score += 5;
  return Math.min(100, score);
}

function extractDateFromSnippet(snippet?: string): string | undefined {
  if (!snippet) return undefined;
  
  // Try to extract common date patterns
  const datePatterns = [
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}\b/i,
    /\b\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\b/i,
    /\b\d{4}-\d{2}-\d{2}\b/
  ];
  
  for (const pattern of datePatterns) {
    const match = snippet.match(pattern);
    if (match) return match[0];
  }
  
  return undefined;
}

// --- PHASE 4: SYNTHESIS ---
async function runPhase4Synthesis(
  text: string,
  evidence: Evidence[],
  context: string,
  tierResults: TierBreakdown[],
  startTime: number,
  config: any
): Promise<FactCheckReport> {
  try {
    const geminiApiKey = config.gemini || process.env.GEMINI_API_KEY;

    // Calculate weighted score from tier results
    const weightedScore = calculateWeightedScore(tierResults, evidence);

    if (!geminiApiKey) {
      logger.warn('Synthesis unavailable: Gemini API key not provided.');
      return createEnhancedStatisticalReport(text, evidence, tierResults, startTime, weightedScore);
    }
    
    if (evidence.length === 0) {
      logger.warn('Synthesis unavailable: No evidence found.');
      return createEnhancedStatisticalReport(text, evidence, tierResults, startTime, 0, "No evidence was found to analyze the claim.");
    }

    const prompt = buildSynthesisPrompt(text, evidence, context);
    const geminiText = await callGeminiAPI(prompt, geminiApiKey, config.geminiModel || 'gemini-2.0-flash-exp');

    if (!geminiText) {
      throw new Error('Empty response from Gemini');
    }

    const synthesis = parseGeminiResponse(geminiText, evidence, weightedScore);

    return {
      id: `fact_check_${Date.now()}`,
      originalText: text,
      finalVerdict: synthesis.verdict,
      finalScore: synthesis.score,
      reasoning: synthesis.reasoning,
      evidence,
      claimVerifications: [],
      scoreBreakdown: {
        finalScoreFormula: 'Weighted average of tier confidence + AI synthesis',
        metrics: [
          {
            name: 'Web Search Quality',
            score: tierResults[1]?.confidence || 0,
            weight: 0.35,
            description: 'Quality and credibility of web search results',
            reasoning: `Found ${tierResults[1]?.evidence.length || 0} web sources`
          },
          {
            name: 'News Coverage',
            score: tierResults[2]?.confidence || 0,
            weight: 0.35,
            description: 'News article coverage and credibility',
            reasoning: `Found ${tierResults[2]?.evidence.length || 0} news articles`
          },
          {
            name: 'AI Analysis',
            score: synthesis.score,
            weight: 0.30,
            description: 'AI-driven synthesis of all evidence',
            reasoning: 'Synthesized from source reputation, consistency, and relevance'
          }
        ]
      },
      metadata: {
        methodUsed: 'tiered-verification-synthesis',
        processingTimeMs: Date.now() - startTime,
        apisUsed: tierResults.filter(t => t.success).map(t => {
          if (t.tier === 'web-search') return 'serp-api';
          if (t.tier === 'news-analysis') return 'webz-news';
          return t.tier;
        }).concat(['gemini-ai']),
        sourcesConsulted: {
          total: evidence.length,
          highCredibility: evidence.filter(e => e.credibilityScore >= 80).length,
          conflicting: 0
        },
        warnings: synthesis.warnings,
        tierBreakdown: tierResults.map(tr => ({
          tier: tr.tier,
          success: tr.success,
          confidence: tr.confidence,
          processingTimeMs: tr.processingTime,
          evidenceCount: tr.evidence.length
        }))
      }
    };
  } catch (error: any) {
    logger.error('Synthesis failed, falling back to statistical report', { errorMessage: error.message });
    const weightedScore = calculateWeightedScore(tierResults, evidence);
    return createEnhancedStatisticalReport(text, evidence, tierResults, startTime, weightedScore);
  }
}

// --- CALCULATE WEIGHTED SCORE ---
function calculateWeightedScore(tierResults: TierBreakdown[], evidence: Evidence[]): number {
  // Weight: Web Search 40%, News 40%, Evidence Quality 20%
  const webSearchScore = tierResults[1]?.confidence || 0;
  const newsScore = tierResults[2]?.confidence || 0;
  
  const avgEvidenceScore = evidence.length > 0
    ? evidence.reduce((sum, e) => sum + e.credibilityScore, 0) / evidence.length
    : 0;
  
  const weightedScore = (webSearchScore * 0.4) + (newsScore * 0.4) + (avgEvidenceScore * 0.2);
  
  logger.info('Calculated weighted score', {
    webSearch: webSearchScore.toFixed(1),
    news: newsScore.toFixed(1),
    evidence: avgEvidenceScore.toFixed(1),
    final: weightedScore.toFixed(1)
  });
  
  return Math.round(weightedScore);
}

// --- ENHANCED STATISTICAL FALLBACK ---
function createEnhancedStatisticalReport(
  text: string,
  evidence: Evidence[],
  tierResults: TierBreakdown[],
  startTime: number,
  weightedScore?: number,
  customReasoning?: string
): FactCheckReport {
  const finalScore = weightedScore !== undefined ? weightedScore : (
    evidence.length > 0
      ? Math.round(evidence.reduce((sum, e) => sum + e.credibilityScore, 0) / evidence.length)
      : 0
  );

  const highCred = evidence.filter(e => e.credibilityScore >= 80).length;
  const mediumCred = evidence.filter(e => e.credibilityScore >= 60 && e.credibilityScore < 80).length;
  const lowCred = evidence.filter(e => e.credibilityScore < 60).length;
  
  const reasoning = customReasoning || buildStatisticalReasoning(evidence, finalScore, highCred, mediumCred, lowCred);

  return {
    id: `fact_check_${Date.now()}`,
    originalText: text,
    finalVerdict: generateVerdictFromScore(finalScore, evidence),
    finalScore,
    reasoning,
    evidence,
    claimVerifications: [],
    scoreBreakdown: {
      finalScoreFormula: 'Weighted(WebSearch × 0.4, News × 0.4, SourceQuality × 0.2)',
      metrics: [
        {
          name: 'Web Search Quality',
          score: tierResults[1]?.confidence || 0,
          weight: 0.4,
          description: 'Credibility of web search results',
          reasoning: `${tierResults[1]?.evidence.length || 0} sources found`
        },
        {
          name: 'News Coverage',
          score: tierResults[2]?.confidence || 0,
          weight: 0.4,
          description: 'News article analysis',
          reasoning: `${tierResults[2]?.evidence.length || 0} news articles found`
        },
        {
          name: 'Source Quality',
          score: finalScore,
          weight: 0.2,
          description: 'Average credibility of all sources',
          reasoning: `${highCred} high, ${mediumCred} medium, ${lowCred} low credibility sources`
        }
      ]
    },
    metadata: {
      methodUsed: 'tiered-statistical-analysis',
      processingTimeMs: Date.now() - startTime,
      apisUsed: tierResults.filter(t => t.success).map(t => {
        if (t.tier === 'web-search') return 'serp-api';
        if (t.tier === 'news-analysis') return 'webz-news';
        return t.tier;
      }),
      sourcesConsulted: {
        total: evidence.length,
        highCredibility: highCred,
        conflicting: 0
      },
      warnings: ['AI synthesis was unavailable; this report is based on statistical analysis of sources.'],
      tierBreakdown: tierResults.map(tr => ({
        tier: tr.tier,
        success: tr.success,
        confidence: tr.confidence,
        processingTimeMs: tr.processingTime,
        evidenceCount: tr.evidence.length
      }))
    }
  };
}

function buildStatisticalReasoning(
  evidence: Evidence[],
  finalScore: number,
  highCred: number,
  mediumCred: number,
  lowCred: number
): string {
  if (evidence.length === 0) {
    return "No evidence found to verify this claim. Further investigation is needed.";
  }

  const parts: string[] = [];
  
  // Source count and quality
  parts.push(`Based on analysis of ${evidence.length} source${evidence.length !== 1 ? 's' : ''}`);
  
  if (highCred > 0) {
    parts.push(`including ${highCred} high-credibility source${highCred !== 1 ? 's' : ''}`);
  }
  
  // Score interpretation
  if (finalScore >= 85) {
    parts.push("the claim appears to be well-supported by reliable sources.");
  } else if (finalScore >= 70) {
    parts.push("the claim has moderate support but may lack full verification.");
  } else if (finalScore >= 50) {
    parts.push("the evidence shows mixed signals with limited reliable confirmation.");
  } else {
    parts.push("there is insufficient reliable evidence to support this claim.");
  }
  
  // Source breakdown
  const sourceBreakdown: string[] = [];
  if (highCred > 0) sourceBreakdown.push(`${highCred} high-quality`);
  if (mediumCred > 0) sourceBreakdown.push(`${mediumCred} moderate`);
  if (lowCred > 0) sourceBreakdown.push(`${lowCred} lower-quality`);
  
  if (sourceBreakdown.length > 0) {
    parts.push(`Sources include: ${sourceBreakdown.join(', ')}.`);
  }

  return parts.join(', ').replace(', the ', '. The ').replace(', Sources', '. Sources');
}

// --- SYNTHESIS PROMPT ---
function buildSynthesisPrompt(text: string, evidence: Evidence[], context: string): string {
  const evidenceSummary = evidence.slice(0, 15).map((e, i) => {
    const date = e.publicationDate ? ` (${formatDate(e.publicationDate)})` : '';
    const credRating = e.credibilityScore >= 80 ? 'HIGH' : e.credibilityScore >= 60 ? 'MED' : 'LOW';
    return `${i + 1}. [${credRating}-${e.credibilityScore}%] ${e.publisher}${date}: "${(e.quote || e.snippet || '').substring(0, 200)}..."`;
  }).join('\n');

  return `As a professional fact-checker for a ${context} publication, analyze the following claim based *only* on the evidence provided.

CLAIM: "${text}"

EVIDENCE (${evidence.length} sources):
${evidenceSummary}

ANALYSIS REQUIREMENTS:
- Assess the overall credibility based on source quality and consistency.
- If the verdict is MIXED, provide a detailed breakdown of the evidence. Explain which parts of the claim are supported and which are not, citing specific sources.
- Consider publication recency and source reputation.
- Note any contradictions or gaps in coverage.
- Be appropriately skeptical with low-credibility sources.

Provide your analysis in this EXACT format:

VERDICT: [TRUE, FALSE, MIXED, UNVERIFIED, MISLEADING]
SCORE: [0-100]
REASONING: [2-3 sentences explaining your verdict. If MIXED, provide a detailed explanation of the conflicting evidence and how it supports different aspects of the claim.]
WARNINGS: [Note any concerns about source quality, contradictions, or limitations. If none, write "None"]`;
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

// --- PARSE GEMINI RESPONSE ---
function parseGeminiResponse(
  text: string,
  evidence: Evidence[],
  weightedScore: number
): { verdict: FactVerdict; score: number; reasoning: string; warnings: string[] } {
  const verdictMatch = text.match(/VERDICT:\s*(TRUE|FALSE|MIXED|UNVERIFIED|MISLEADING)/i);
  const scoreMatch = text.match(/SCORE:\s*(\d+)/i);
  const reasoningMatch = text.match(/REASONING:\s*(.+?)(?=WARNINGS:|$)/is);
  const warningsMatch = text.match(/WARNINGS:\s*(.+)/is);

  // Use AI score if provided, otherwise use weighted score
  let finalScore = scoreMatch ? parseInt(scoreMatch[1], 10) : weightedScore;
  
  // Blend AI score with weighted score for better accuracy
  if (scoreMatch && weightedScore > 0) {
    const aiScore = parseInt(scoreMatch[1], 10);
    finalScore = Math.round((aiScore * 0.6) + (weightedScore * 0.4));
  }

  const verdict = verdictMatch ? mapVerdict(verdictMatch[1]) : generateVerdictFromScore(finalScore, evidence);
  const reasoning = reasoningMatch?.[1]?.trim() || 
    `Analysis based on ${evidence.length} sources with an average credibility of ${finalScore}%. ${evidence.filter(e => e.credibilityScore >= 80).length} high-quality sources were consulted.`;
  
  const warnings: string[] = [];
  if (warningsMatch && warningsMatch[1].toLowerCase().trim() !== 'none') {
    warnings.push(warningsMatch[1].trim());
  }
  
  // Add automatic warnings
  if (evidence.filter(e => e.credibilityScore < 60).length > evidence.length / 2) {
    warnings.push('Majority of sources have low credibility ratings');
  }
  if (evidence.length < 3) {
    warnings.push('Limited number of sources available for verification');
  }

  return { verdict, score: finalScore, reasoning, warnings };
}

function mapVerdict(verdictStr: string): FactVerdict {
  const upper = (verdictStr || '').toUpperCase().trim();
  const verdicts: FactVerdict[] = ['TRUE', 'FALSE', 'MIXED', 'UNVERIFIED', 'MISLEADING'];
  return verdicts.find(v => v === upper) || 'UNVERIFIED';
}

function generateVerdictFromScore(score: number, evidence: Evidence[]): FactVerdict {
  // Consider both score and evidence quality
  const highQualitySources = evidence.filter(e => e.credibilityScore >= 80).length;
  const hasMultipleSources = evidence.length >= 3;
  
  if (score >= 85 && highQualitySources >= 2) return 'TRUE';
  if (score >= 70 && hasMultipleSources) return 'MIXED';
  if (score >= 50) return 'MIXED';
  if (score >= 30) return 'MISLEADING';
  if (score >= 15 && evidence.length > 0) return 'FALSE';
  return 'UNVERIFIED';
}

// --- VALIDATION ---
async function validateCitations(evidence: Evidence[]): Promise<Evidence[]> {
  return evidence.map(item => ({
    ...item,
    score: Math.min(100, item.score + calculateCredibilityBonus(item.url)),
    credibilityScore: Math.min(100, item.credibilityScore + calculateCredibilityBonus(item.url)),
  }));
}

function calculateCredibilityBonus(url?: string): number {
  if (!url) return -5;
  if (url.includes('.gov') || url.includes('.edu')) return 5;
  if (url.startsWith('https://')) return 2;
  if (url.startsWith('http://')) return -3;
  return 0;
}

// --- EXTRACTION HELPERS ---
function extractSmartQuery(text: string, maxLength: number): string {
  // Remove common filler words for better search
  const fillers = /\b(the|a|an|is|are|was|were|been|be|have|has|had|do|does|did|will|would|could|should|may|might|must|can|very|really|just|only|also|however|therefore)\b/gi;
  const cleaned = text.replace(fillers, ' ').replace(/\s+/g, ' ').trim();
  
  const firstSentence = cleaned.match(/^[^.!?]+[.!?]/)?.[0] || cleaned;
  const trimmed = firstSentence.trim();
  
  if (trimmed.length <= maxLength) return trimmed;
  
  // Try to end at a word boundary
  const truncated = trimmed.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return lastSpace > maxLength * 0.7 ? truncated.substring(0, lastSpace) : truncated;
}

function extractKeyEntities(text: string): string[] {
  // Extract capitalized words (potential proper nouns)
  const words = text.replace(/[^\w\s]/g, ' ').split(/\s+/);
  const entities = words.filter(w => /^[A-Z]/.test(w) && w.length > 2 && !/^(The|A|An|This|That|These|Those|It|They|We|You|He|She)$/.test(w));
  
  // Remove duplicates and limit
  return [...new Set(entities)].slice(0, 5);
}

function getRecentDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 90); // Last 90 days
  return d.toISOString().split('T')[0];
}

function deduplicateEvidence(evidence: Evidence[]): Evidence[] {
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  
  return evidence.filter(item => {
    // Deduplicate by URL
    if (!item.url || seenUrls.has(item.url)) {
      return false;
    }
    
    // Also check for near-duplicate titles
    const normalizedTitle = item.title.toLowerCase().replace(/[^\w\s]/g, '').trim();
    if (normalizedTitle && seenTitles.has(normalizedTitle)) {
      return false;
    }
    
    seenUrls.add(item.url);
    if (normalizedTitle) seenTitles.add(normalizedTitle);
    return true;
  });
}
