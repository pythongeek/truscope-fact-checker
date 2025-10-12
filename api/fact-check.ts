// api/fact-check.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateTextWithFallback } from '../src/services/geminiService';
import { logger } from '../src/utils/logger';
import { Evidence, FactVerdict, TierBreakdown, ApiKeys, FactCheckReport } from '../src/types/index';

const GOOGLE_FACT_CHECK_URL = 'https://factchecktools.googleapis.com/v1alpha1/claims:search';

interface FactCheckRequest {
  text: string;
  publishingContext?: string;
  config?: ApiKeys;
}

// --- Main Handler ---
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    logger.warn('Method not allowed', { method: req.method });
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  const { text, publishingContext = 'journalism', config = {} }: FactCheckRequest = req.body;

  if (!text || text.trim().length === 0) {
    logger.warn('Text is required for fact-checking');
    return res.status(400).json({ error: 'Text is required for fact-checking' });
  }

  logger.info('Starting Tiered Fact-Check', { textLength: text.length, context: publishingContext });

  try {
    const [phase1Result, phase2Result, phase3Result] = await Promise.all([
      runPhase1(text, config),
      runPhase2(text, req),
      runPhase3(text, req)
    ]);

    const tierResults = [phase1Result, phase2Result, phase3Result];
    const allEvidence = deduplicateEvidence([
      ...phase1Result.evidence,
      ...phase2Result.evidence,
      ...phase3Result.evidence
    ]);

    logger.info(`Total evidence collected: ${allEvidence.length}`);

    const validatedEvidence = await validateCitations(allEvidence);

    const finalReport = await runPhase4Synthesis(
      text,
      validatedEvidence,
      publishingContext,
      tierResults,
      startTime,
      config
    );

    logger.info('Fact-Check Complete', { final_score: finalReport.final_score });
    return res.status(200).json(finalReport);

  } catch (error: any) {
    logger.error('Fact-check failed', { error: error.message, stack: error.stack });
    return res.status(500).json({
      error: 'Fact-check failed',
      details: error.message,
    });
  }
}

// --- Verification Phases ---

async function runPhase1(text: string, config: ApiKeys): Promise<TierBreakdown> {
  const startTime = Date.now();
  try {
    const query = extractSmartQuery(text, 100);
    const apiKey = config.factCheck || process.env.GOOGLE_FACT_CHECK_API_KEY;

    if (!apiKey) {
      throw new Error('Google Fact Check API key not configured');
    }

    const url = `${GOOGLE_FACT_CHECK_URL}?query=${encodeURIComponent(query)}&key=${apiKey}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Fact Check API error: ${response.status}`);
    }

    const data = await response.json();
    const claims = data.claims || [];
    const evidence: Evidence[] = claims.slice(0, 5).map((claim: any) => {
      const review = claim.claimReview?.[0];
      return {
        quote: `${claim.text} - ${review?.textualRating || 'Unknown'}`,
        publisher: review?.publisher?.name || 'Fact Checker',
        url: review?.url || '',
        score: convertRatingToScore(review?.textualRating),
        publishedDate: claim.claimDate,
      };
    }).filter((e: Evidence) => e.url);

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
    logger.warn('Phase 1 failed', { error: error.message });
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

async function runPhase2(text: string, req: VercelRequest): Promise<TierBreakdown> {
  const startTime = Date.now();
  try {
    const query = extractSmartQuery(text, 100);
    const baseUrl = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers['x-forwarded-host'] || req.headers.host}`;
    
    const response = await fetch(`${baseUrl}/api/serp-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });

    if (!response.ok) {
      throw new Error(`SERP API error: ${response.status}`);
    }

    const data = await response.json();
    const results = data.organic || [];
    const evidence: Evidence[] = results.slice(0, 10).map((result: any) => ({
      quote: result.snippet || '',
      publisher: result.domain || result.source || 'Unknown',
      url: result.link,
      score: calculateSourceScore(result.domain || result.source),
      publishedDate: result.date,
    })).filter((e: Evidence) => e.url);
    
    const confidence = evidence.length > 0 ? evidence.reduce((sum, e) => sum + e.score, 0) / evidence.length : 0;
    logger.info(`Phase 2: Found ${evidence.length} web results`, { confidence: confidence.toFixed(1) });
    
    return {
      tier: 'web-search',
      success: evidence.length > 0,
      confidence,
      evidence,
      processingTime: Date.now() - startTime
    };
  } catch (error: any) {
    logger.warn('Phase 2 failed', { error: error.message });
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

async function runPhase3(text: string, req: VercelRequest): Promise<TierBreakdown> {
    const startTime = Date.now();
    try {
      const entities = extractKeyEntities(text);
      if (entities.length === 0) {
        throw new Error('No key entities found for news search');
      }
  
      const newsQuery = entities.slice(0, 3).join(' ');
      const baseUrl = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers['x-forwarded-host'] || req.headers.host}`;
      
      const response = await fetch(`${baseUrl}/api/webz-news-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: newsQuery, fromDate: getRecentDate() })
      });
  
      if (!response.ok) {
        throw new Error(`News API error: ${response.status}`);
      }
  
      const data = await response.json();
      const posts = data.posts || [];
      const evidence: Evidence[] = posts.slice(0, 5).map((post: any) => ({
        quote: post.text?.substring(0, 300) || '',
        publisher: post.author || post.thread?.site || 'News Source',
        url: post.url,
        score: 70, // Default score for news articles
        publishedDate: post.published,
      })).filter((e: Evidence) => e.url);
  
      logger.info(`Phase 3: Found ${evidence.length} news articles`);
  
      return {
        tier: 'news-analysis',
        success: evidence.length > 0,
        confidence: 70,
        evidence,
        processingTime: Date.now() - startTime
      };
    } catch (error: any) {
      logger.warn('Phase 3 failed', { error: error.message });
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
  
// --- Synthesis and Reporting ---

async function runPhase4Synthesis(
    text: string,
    evidence: Evidence[],
    context: string,
    tierResults: TierBreakdown[],
    startTime: number,
    config: ApiKeys
  ): Promise<FactCheckReport> {
    try {
      const geminiApiKey = config.gemini || process.env.GEMINI_API_KEY;
  
      if (!geminiApiKey || evidence.length === 0) {
        logger.warn('Synthesis unavailable, using statistical fallback');
        return createStatisticalReport(text, evidence, tierResults, startTime);
      }
  
      const prompt = buildSynthesisPrompt(text, evidence, context);
      const geminiText = await generateTextWithFallback(prompt, {
        apiKey: geminiApiKey,
        model: config.geminiModel,
        temperature: 0.3,
        maxOutputTokens: 1024,
      });
  
      if (!geminiText) {
        throw new Error('Empty response from Gemini');
      }
  
      const synthesis = parseGeminiResponse(geminiText, evidence);
  
      return {
        id: `fact_check_${Date.now()}`,
        originalText: text,
        final_verdict: synthesis.verdict,
        final_score: synthesis.score,
        reasoning: synthesis.reasoning,
        evidence,
        metadata: {
          method_used: 'tiered-verification-synthesis',
          processing_time_ms: Date.now() - startTime,
          apisUsed: ['google-fact-check', 'serp-api', 'webz-news', 'gemini-ai'],
          sources_consulted: {
            total: evidence.length,
            high_credibility: evidence.filter(e => e.score >= 75).length,
            conflicting: 0
          },
          warnings: synthesis.warnings,
          tier_breakdown: tierResults
        }
      };
    } catch (error: any) {
      logger.error('Synthesis failed, falling back to statistical report', { error: error.message });
      return createStatisticalReport(text, evidence, tierResults, startTime);
    }
}

function createStatisticalReport(
    text: string,
    evidence: Evidence[],
    tierResults: TierBreakdown[],
    startTime: number
  ): FactCheckReport {
    const avgScore = evidence.length > 0
      ? Math.round(evidence.reduce((sum, e) => sum + e.score, 0) / evidence.length)
      : 0;
  
    const highCred = evidence.filter(e => e.score >= 75).length;
  
    return {
      id: `fact_check_${Date.now()}`,
      originalText: text,
      final_verdict: generateVerdictFromScore(avgScore),
      final_score: avgScore,
      reasoning: `Analysis based on ${evidence.length} sources. ${highCred} sources were high-credibility (≥75%). Average source score: ${avgScore}%.`,
      evidence,
      metadata: {
        method_used: 'tiered-statistical-fallback',
        processing_time_ms: Date.now() - startTime,
        apisUsed: ['google-fact-check', 'serp-api', 'webz-news'],
        sources_consulted: {
          total: evidence.length,
          high_credibility: highCred,
          conflicting: 0
        },
        warnings: ['AI synthesis was unavailable; this report is based on statistical analysis of sources.'],
        tier_breakdown: tierResults
      }
    };
}
  
// --- Helper Functions ---

async function validateCitations(evidence: Evidence[]): Promise<Evidence[]> {
    // This is a simplified validation. A real implementation might be more complex.
    return evidence.map(item => ({
      ...item,
      score: item.score + calculateCredibilityBonus(item.url),
    }));
}

function buildSynthesisPrompt(text: string, evidence: Evidence[], context: string): string {
    const evidenceSummary = evidence.slice(0, 15).map((e, i) =>
      `${i + 1}. [${e.score}% credibility] from ${e.publisher}: "${(e.quote || '').substring(0, 150)}..."`
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
  
    const verdict = verdictMatch ? mapVerdict(verdictMatch[1]) : generateVerdictFromScore(score);
    const reasoning = reasoningMatch?.[1]?.trim() || `Analysis based on ${evidence.length} sources with an average credibility of ${score}%.`;
    const warnings = (warningsMatch && warningsMatch[1].toLowerCase().trim() !== 'none') ? [warningsMatch[1].trim()] : [];
  
    return { verdict, score, reasoning, warnings };
}

// --- Utility Functions ---

function mapVerdict(verdictStr: string): FactVerdict {
    const upperCaseVerdict = (verdictStr || '').toUpperCase().trim();
    switch (upperCaseVerdict) {
      case 'TRUE':
      case 'MOSTLY TRUE':
        return 'TRUE';
      case 'FALSE':
      case 'MOSTLY FALSE':
        return 'FALSE';
      case 'MIXED':
        return 'MIXED';
      case 'MISLEADING':
        return 'MISLEADING';
      default:
        return 'UNVERIFIED';
    }
}

function generateVerdictFromScore(score: number): FactVerdict {
    if (score > 80) return 'TRUE';
    if (score > 60) return 'MIXED';
    if (score > 40) return 'MISLEADING';
    if (score > 20) return 'FALSE';
    return 'UNVERIFIED';
}
  
function convertRatingToScore(rating: string): number {
    const lower = (rating || '').toLowerCase();
    if (lower.includes('true')) return 90;
    if (lower.includes('mostly true')) return 75;
    if (lower.includes('half true') || lower.includes('mixed')) return 50;
    if (lower.includes('mostly false')) return 25;
    if (lower.includes('false') || lower.includes('pants on fire')) return 10;
    return 50; // Default for 'Unrated', 'Unknown', etc.
}

function calculateSourceScore(source: string): number {
    const lower = (source || '').toLowerCase();
    if (/reuters|apnews|bbc\.com|pbs\.org/i.test(lower)) return 90;
    if (/factcheck\.org|snopes|politifact/i.test(lower)) return 88;
    if (/nytimes\.com|washingtonpost\.com|wsj\.com|theguardian\.com/i.test(lower)) return 85;
    if (/\.gov|\.edu/i.test(lower)) return 80;
    if (/cnn\.com|npr\.org|abcnews\.go\.com|cbsnews\.com/i.test(lower)) return 75;
    return 60; // Default for other sources
}

function calculateCredibilityBonus(url?: string): number {
    if (!url) return -10;
    if (url.includes('.gov') || url.includes('.edu')) return 5;
    if (url.startsWith('http://')) return -5; // Penalize non-HTTPS
    return 0;
}

function extractSmartQuery(text: string, maxLength: number): string {
    const firstSentence = text.match(/^[^.!?]+[.!?]/)?.[0] || text;
    if (firstSentence.length <= maxLength) return firstSentence.trim();
    const truncated = firstSentence.substring(0, maxLength);
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
