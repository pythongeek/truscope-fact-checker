// api/fact-check.ts - OPTIMIZED FOR VERCEL SERVERLESS
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
const API_TIMEOUT = 3000; // 3 seconds per API call

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

// --- INLINE SERVICES ---

const logger = {
  info: (msg: string, meta?: any) => console.log(JSON.stringify({ level: 'INFO', message: msg, ...meta })),
  warn: (msg: string, meta?: any) => console.warn(JSON.stringify({ level: 'WARN', message: msg, ...meta })),
  error: (msg: string, meta?: any) => console.error(JSON.stringify({ level: 'ERROR', message: msg, ...meta }))
};

// Fetch with timeout wrapper
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
  const { text, publishingContext = 'journalism', config = {} } = req.body;

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    logger.warn('Validation failed: Text is required');
    return res.status(400).json({ error: 'Text is required for fact-checking.' });
  }

  logger.info('Starting Tiered Fact-Check', { textLength: text.length, context: publishingContext });

  try {
    // Run phases in parallel with Promise.allSettled to handle failures gracefully
    const phasePromises = await Promise.allSettled([
      runPhase1(text, config),
      runPhase2Direct(text, config),
      runPhase3Direct(text, config)
    ]);

    // Extract results, treating rejected promises as failed phases
    const phase1Result = phasePromises[0].status === 'fulfilled' 
      ? phasePromises[0].value 
      : createFailedPhase('direct-verification', (phasePromises[0] as PromiseRejectedResult).reason);
    
    const phase2Result = phasePromises[1].status === 'fulfilled' 
      ? phasePromises[1].value 
      : createFailedPhase('web-search', (phasePromises[1] as PromiseRejectedResult).reason);
    
    const phase3Result = phasePromises[2].status === 'fulfilled' 
      ? phasePromises[2].value 
      : createFailedPhase('news-analysis', (phasePromises[2] as PromiseRejectedResult).reason);

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

    logger.info('Fact-Check Complete', { finalScore: finalReport.finalScore, verdict: finalReport.finalVerdict });
    return res.status(200).json(finalReport);

  } catch (error: any) {
    logger.error('Unhandled error in fact-check handler', { errorMessage: error.message, stack: error.stack });
    return res.status(500).json({
      error: 'A server error has occurred.',
      details: error.message,
    });
  }
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

// --- VERIFICATION PHASES ---

async function runPhase1(text: string, config: any): Promise<TierBreakdown> {
  const startTime = Date.now();
  try {
    const query = extractSmartQuery(text, 100);
    const apiKey = config.factCheck || process.env.GOOGLE_FACT_CHECK_API_KEY;

    if (!apiKey) {
      throw new Error('Google Fact Check API key not configured');
    }

    const url = `${GOOGLE_FACT_CHECK_URL}?query=${encodeURIComponent(query)}&key=${apiKey}`;
    const response = await fetchWithTimeout(url, { method: 'GET' }, API_TIMEOUT);

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error('Google Fact Check API HTTP error', { status: response.status, body: errorBody });
      throw new Error(`Fact Check API error: ${response.status}`);
    }

    const data = await response.json();
    const claims = data.claims || [];
    const evidence: Evidence[] = claims.slice(0, 5).map((claim: any, index: number): Evidence | null => {
      const review = claim.claimReview?.[0];
      if (!review?.url) return null;
      const rating = convertRatingToScore(review?.textualRating);

      return {
        id: `fc_${Date.now()}_${index}`,
        quote: `${claim.text} - ${review?.textualRating || 'Unknown'}`,
        title: review?.title || claim.text || 'Fact Check Result',
        snippet: review?.textualRating || 'No rating available',
        publisher: review?.publisher?.name || 'Fact Checker',
        url: review.url,
        score: rating,
        credibilityScore: rating,
        relevanceScore: 85,
        publicationDate: claim.claimDate,
        publishedDate: claim.claimDate,
        type: 'claim' as const,
        source: {
          name: review?.publisher?.name || 'Fact Checker',
          url: review?.publisher?.site || review.url,
          credibility: {
            rating: rating >= 80 ? 'High' : rating >= 60 ? 'Medium' : 'Low',
            classification: 'Fact Checking Organization',
            warnings: []
          }
        }
      };
    }).filter((e): e is Evidence => e !== null);

    const confidence = evidence.length > 0 ? evidence.reduce((sum, e) => sum + e.score, 0) / evidence.length : 0;
    logger.info(`Phase 1: Found ${evidence.length} fact-checks`, { confidence: confidence.toFixed(1) });

    return {
      tier: 'direct-verification',
      success: evidence.length > 0,
      confidence,
      evidence,
      processingTime: Date.now() - startTime
    };
  } catch (error: any) {
    logger.warn('Phase 1 failed', { errorMessage: error.message });
    return {
      tier: 'direct-verification',
      success: false,
      confidence: 0,
      evidence: [],
      processingTime: Date.now() - startTime,
      escalationReason: error.message
    };
  }
}

// Direct SERP API call (no internal routing)
async function runPhase2Direct(text: string, config: any): Promise<TierBreakdown> {
  const startTime = Date.now();
  try {
    const query = extractSmartQuery(text, 100);
    const apiKey = process.env.SERP_API_KEY;

    if (!apiKey) {
      throw new Error('SERP API key not configured');
    }

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
    const evidence = mapSerpResultsToEvidence(data.organic || []);

    const confidence = evidence.length > 0 ? evidence.reduce((sum, e) => sum + e.score, 0) / evidence.length : 0;
    logger.info(`Phase 2: Found ${evidence.length} SERP results`, { confidence: confidence.toFixed(1) });

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

// Direct Webz API call (no internal routing)
async function runPhase3Direct(text: string, config: any): Promise<TierBreakdown> {
  const startTime = Date.now();
  try {
    const entities = extractKeyEntities(text);
    if (entities.length === 0) {
      logger.warn('Phase 3: No key entities found, skipping news search.');
      return {
        tier: 'news-analysis',
        success: false,
        confidence: 0,
        evidence: [],
        processingTime: 0,
        escalationReason: 'No key entities found'
      };
    }

    const newsQuery = entities.slice(0, 3).join(' ');
    const apiKey = process.env.WEBZ_API_KEY;

    if (!apiKey) {
      throw new Error('Webz API key not configured');
    }

    const params = new URLSearchParams({
      token: apiKey,
      q: newsQuery,
      size: '10',
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

    const confidence = evidence.length > 0 ? evidence.reduce((sum, e) => sum + e.score, 0) / evidence.length : 0;
    logger.info(`Phase 3: Found ${evidence.length} news results`, { confidence: confidence.toFixed(1) });

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

// --- Mappers for Phase 2 & 3 ---
function mapSerpResultsToEvidence(results: any[] = []): Evidence[] {
  return results.slice(0, 10).map((result: any, index: number): Evidence | null => {
    if (!result.link) return null;
    const domain = result.domain || result.source || 'Unknown';
    const credScore = calculateSourceScore(domain);

    return {
      id: `serp_${Date.now()}_${index}`,
      quote: result.snippet || '',
      title: result.title || 'Search Result',
      snippet: result.snippet || '',
      publisher: domain,
      url: result.link,
      score: credScore,
      credibilityScore: credScore,
      relevanceScore: 75,
      publicationDate: result.date,
      publishedDate: result.date,
      type: 'search_result' as const,
      source: { 
        name: domain, 
        url: result.link, 
        credibility: { 
          rating: credScore >= 80 ? 'High' : credScore >= 60 ? 'Medium' : 'Low', 
          classification: 'Web Source', 
          warnings: [] 
        } 
      }
    };
  }).filter((e): e is Evidence => e !== null);
}

function mapNewsResultsToEvidence(posts: any[] = []): Evidence[] {
  return posts.slice(0, 5).map((post: any, index: number): Evidence | null => {
    if (!post.url) return null;
    const publisher = post.author || post.thread?.site || 'News Source';
    return {
      id: `news_${Date.now()}_${index}`,
      quote: post.text?.substring(0, 300) || '',
      title: post.title || 'News Article',
      snippet: post.text?.substring(0, 200) || '',
      publisher,
      url: post.url,
      score: 70,
      credibilityScore: 70,
      relevanceScore: 80,
      publicationDate: post.published,
      publishedDate: post.published,
      type: 'news' as const,
      source: { 
        name: publisher, 
        url: post.url, 
        credibility: { 
          rating: 'Medium', 
          classification: 'News Source', 
          warnings: [] 
        } 
      }
    };
  }).filter((e): e is Evidence => e !== null);
}

// --- SYNTHESIS AND REPORTING ---

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

    if (!geminiApiKey) {
      logger.warn('Synthesis unavailable: Gemini API key not provided.');
      return createStatisticalReport(text, evidence, tierResults, startTime);
    }
    if (evidence.length === 0) {
      logger.warn('Synthesis unavailable: No evidence found.');
      return createStatisticalReport(text, evidence, tierResults, startTime, "No evidence was found to analyze the claim.");
    }

    const prompt = buildSynthesisPrompt(text, evidence, context);
    const geminiText = await callGeminiAPI(prompt, geminiApiKey, config.geminiModel);

    if (!geminiText) {
      throw new Error('Empty response from Gemini');
    }

    const synthesis = parseGeminiResponse(geminiText, evidence);

    return {
      id: `fact_check_${Date.now()}`,
      originalText: text,
      finalVerdict: synthesis.verdict,
      finalScore: synthesis.score,
      reasoning: synthesis.reasoning,
      evidence,
      claimVerifications: [],
      scoreBreakdown: {
        finalScoreFormula: 'AI-driven synthesis based on evidence credibility.',
        metrics: [
          { 
            name: 'Synthesized Credibility', 
            score: synthesis.score, 
            weight: 1.0, 
            description: 'Overall credibility based on AI analysis of sources.', 
            reasoning: 'Synthesized from source reputation, consistency, and relevance.' 
          }
        ]
      },
      metadata: {
        methodUsed: 'tiered-verification-synthesis',
        processingTimeMs: Date.now() - startTime,
        apisUsed: ['google-fact-check', 'serp-api', 'webz-news', 'gemini-ai'],
        sourcesConsulted: { 
          total: evidence.length, 
          highCredibility: evidence.filter(e => e.score >= 75).length, 
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
    return createStatisticalReport(text, evidence, tierResults, startTime);
  }
}

function createStatisticalReport(
  text: string,
  evidence: Evidence[],
  tierResults: TierBreakdown[],
  startTime: number,
  customReasoning?: string
): FactCheckReport {
  const avgScore = evidence.length > 0
    ? Math.round(evidence.reduce((sum, e) => sum + e.score, 0) / evidence.length)
    : 0;

  const highCred = evidence.filter(e => e.score >= 75).length;
  const reasoning = customReasoning || `Analysis based on ${evidence.length} sources. ${highCred} sources were high-credibility (≥75%). Average source score: ${avgScore}%.`;

  return {
    id: `fact_check_${Date.now()}`,
    originalText: text,
    finalVerdict: generateVerdictFromScore(avgScore),
    finalScore: avgScore,
    reasoning,
    evidence,
    claimVerifications: [],
    scoreBreakdown: {
      finalScoreFormula: 'Average(evidence.credibilityScore)',
      metrics: [
        { 
          name: 'Source Credibility', 
          score: avgScore, 
          weight: 1.0, 
          description: 'Average credibility of all sources', 
          reasoning: `${evidence.length} sources analyzed` 
        }
      ]
    },
    metadata: {
      methodUsed: 'tiered-statistical-fallback',
      processingTimeMs: Date.now() - startTime,
      apisUsed: tierResults.filter(t => t.success).map(t => t.tier),
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

// --- HELPER & UTILITY FUNCTIONS ---

async function validateCitations(evidence: Evidence[]): Promise<Evidence[]> {
  return evidence.map(item => ({
    ...item,
    score: Math.min(100, item.score + calculateCredibilityBonus(item.url)),
    credibilityScore: Math.min(100, item.credibilityScore + calculateCredibilityBonus(item.url)),
  }));
}

function buildSynthesisPrompt(text: string, evidence: Evidence[], context: string): string {
  const evidenceSummary = evidence.slice(0, 15).map((e, i) =>
    `${i + 1}. [${e.score}% credibility] from ${e.publisher}: "${(e.quote || e.snippet || '').substring(0, 150)}..."`
  ).join('\n');

  return `As a professional fact-checker for a ${context} publication, analyze the following claim based *only* on the evidence provided.

CLAIM: "${text}"

EVIDENCE:
${evidenceSummary}

Your task is to provide a structured analysis in the following format, and nothing else:
VERDICT: [TRUE, FALSE, MIXED, UNVERIFIED, MISLEADING]
SCORE: [0-100]
REASONING: [A brief, 2-sentence explanation synthesizing the evidence to justify the verdict and score.]
WARNINGS: [Note any major contradictions in evidence or reliance on low-credibility sources. If none, write "None".]`;
}

function parseGeminiResponse(text: string, evidence: Evidence[]): { verdict: FactVerdict; score: number; reasoning: string; warnings: string[] } {
  const verdictMatch = text.match(/VERDICT:\s*(TRUE|FALSE|MIXED|UNVERIFIED|MISLEADING)/i);
  const scoreMatch = text.match(/SCORE:\s*(\d+)/i);
  const reasoningMatch = text.match(/REASONING:\s*(.+?)(?=WARNINGS:|$)/is);
  const warningsMatch = text.match(/WARNINGS:\s*(.+)/is);

  const score = scoreMatch ? parseInt(scoreMatch[1], 10) :
    (evidence.length > 0 ? Math.round(evidence.reduce((s, e) => s + e.score, 0) / evidence.length) : 50);

  return {
    verdict: verdictMatch ? mapVerdict(verdictMatch[1]) : generateVerdictFromScore(score),
    reasoning: reasoningMatch?.[1]?.trim() || `Analysis based on ${evidence.length} sources with an average credibility of ${score}%.`,
    warnings: (warningsMatch && warningsMatch[1].toLowerCase().trim() !== 'none') ? [warningsMatch[1].trim()] : [],
    score
  };
}

function mapVerdict(verdictStr: string): FactVerdict {
  const upper = (verdictStr || '').toUpperCase().trim();
  const verdicts: FactVerdict[] = ['TRUE', 'FALSE', 'MIXED', 'UNVERIFIED', 'MISLEADING'];
  return verdicts.find(v => v === upper) || 'UNVERIFIED';
}

function generateVerdictFromScore(score: number): FactVerdict {
  if (score >= 85) return 'TRUE';
  if (score >= 60) return 'MIXED';
  if (score >= 40) return 'MISLEADING';
  if (score > 20) return 'FALSE';
  return 'UNVERIFIED';
}

function convertRatingToScore(rating: string): number {
  const lower = (rating || '').toLowerCase();
  if (lower.includes('true')) return 95;
  if (lower.includes('mostly true')) return 80;
  if (lower.includes('half true') || lower.includes('mixed')) return 50;
  if (lower.includes('mostly false')) return 25;
  if (lower.includes('false') || lower.includes('pants on fire')) return 10;
  return 45;
}

function calculateSourceScore(source: string): number {
  const s = (source || '').toLowerCase();
  if (['reuters.com', 'apnews.com', 'bbc.com', 'pbs.org', 'npr.org'].some(d => s.includes(d))) return 95;
  if (['factcheck.org', 'snopes.com', 'politifact.com'].some(d => s.includes(d))) return 92;
  if (['nytimes.com', 'washingtonpost.com', 'wsj.com', 'theguardian.com'].some(d => s.includes(d))) return 88;
  if (/\.gov|\.edu/i.test(s)) return 85;
  if (['cnn.com', 'abcnews.go.com', 'cbsnews.com', 'nbcnews.com'].some(d => s.includes(d))) return 78;
  return 60;
}

function calculateCredibilityBonus(url?: string): number {
  if (!url) return -5;
  if (url.includes('.gov') || url.includes('.edu')) return 5;
  if (url.startsWith('http://')) return -2;
  return 0;
}

function extractSmartQuery(text: string, maxLength: number): string {
  const firstSentence = text.match(/^[^.!?]+[.!?]/)?.[0] || text;
  const trimmed = firstSentence.trim();
  if (trimmed.length <= maxLength) return trimmed;
  const truncated = trimmed.substring(0, maxLength);
  return truncated.substring(0, truncated.lastIndexOf(' '));
}

function extractKeyEntities(text: string): string[] {
  const words = text.replace(/[^\w\s]/g, '').split(/\s+/);
  const entities = words.filter(w => /^[A-Z]/.test(w) && w.length > 3);
  return [...new Set(entities)].slice(0, 5);
}

function getRecentDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return d.toISOString().split('T')[0];
}

function deduplicateEvidence(evidence: Evidence[]): Evidence[] {
  const seenUrls = new Set<string>();
  return evidence.filter(item => {
    if (!item.url || seenUrls.has(item.url)) {
      return false;
    }
    seenUrls.add(item.url);
    return true;
  });
}
