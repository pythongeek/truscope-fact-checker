// api/fact-check.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateTextWithFallback } from '../src/services/geminiService';
import { logger } from '../src/utils/logger';
import { EvidenceItem, FactVerdict } from '../src/types';

const GOOGLE_FACT_CHECK_URL = 'https://factchecktools.googleapis.com/v1alpha1/claims:search';

interface FactCheckRequest {
  text: string;
  publishingContext?: 'journalism' | 'editorial' | 'content';
  config?: {
    gemini?: string;
    geminiModel?: string;
    factCheck?: string;
    search?: string;
    searchId?: string;
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
  console.log('Vercel log: Starting Tiered Fact-Check');

  try {
    logger.info('Executing phases in parallel...');
    console.log('Vercel log: Executing phases in parallel...');
    const [phase1Result, phase2Result, phase3Result] = await Promise.all([
      runPhase1(text, config),
      runPhase2(text, req, config),
      runPhase3(text, [], req, config)
    ]);

    const tierResults = [phase1Result, phase2Result, phase3Result];
    logger.info('Parallel gathering complete.');
    console.log('Vercel log: Parallel gathering complete.');

    const allEvidence = deduplicateEvidence([
      ...phase1Result.evidence,
      ...phase2Result.evidence,
      ...phase3Result.evidence
    ]);

    logger.info(`Total evidence collected: ${allEvidence.length}`);
    console.log(`Vercel log: Total evidence collected: ${allEvidence.length}`);

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
    console.log(`Vercel log: Fact-Check Complete: ${finalReport.final_score}`);
    return res.status(200).json(finalReport);

  } catch (error: any) {
    logger.error('Fact-check failed', error);
    console.error('Vercel log: Fact-check failed', error);
    return res.status(500).json({
      error: 'Fact-check failed',
      details: error.message,
      id: `error_${Date.now()}`,
      originalText: text,
      final_verdict: 'Uncertain',
      final_score: 0,
      evidence: [],
      processingTime: Date.now() - startTime
    });
  }
}

async function runPhase1(text: string, config: any) {
  const startTime = Date.now();
  const evidence: EvidenceItem[] = [];

  try {
    const query = extractSmartQuery(text, 100);
    const apiKey = config.factCheck || process.env.GOOGLE_FACT_CHECK_API_KEY;

    if (!apiKey) {
      logger.warn('Google Fact Check API key not configured');
      return {
        tier: 'direct-verification',
        success: false,
        confidence: 0,
        evidence: [],
        processingTime: Date.now() - startTime
      };
    }

    const url = `${GOOGLE_FACT_CHECK_URL}?query=${encodeURIComponent(query)}&key=${apiKey}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Fact Check API error: ${response.status}`);
    }

    const data = await response.json();
    const claims = data.claims || [];

    for (let i = 0; i < Math.min(claims.length, 5); i++) {
      const claim = claims[i];
      const review = claim.claimReview?.[0];

      if (review) {
        const publisher = typeof review.publisher === 'string'
          ? review.publisher
          : review.publisher?.name || 'Fact Checker';

        evidence.push({
          id: `factcheck_${i}`,
          publisher,
          url: review.url || '',
          quote: `${claim.text} - ${review.textualRating || 'Unknown'}`,
          score: convertRatingToScore(review.textualRating),
          type: 'claim',
          title: '',
          snippet: '',
          source: {
            name: 'Unknown',
            url: '',
            credibility: {
              rating: 'Medium',
              classification: 'Unverified',
              warnings: [],
            },
          }
        });
      }
    }

    const avgScore = evidence.length > 0
      ? evidence.reduce((sum, e) => sum + e.score, 0) / evidence.length
      : 0;

    logger.info(`Phase 1: Found ${evidence.length} fact-checks`, { avgScore: avgScore.toFixed(1) });

    return {
      tier: 'direct-verification',
      success: evidence.length > 0,
      confidence: avgScore,
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
      error: error.message
    };
  }
}

async function runPhase2(text: string, req: VercelRequest, config: any) {
  const startTime = Date.now();
  const evidence: EvidenceItem[] = [];

  try {
    const query = extractSmartQuery(text, 100);
    
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const baseUrl = `${protocol}://${host}`;

    logger.info('Calling SERP API', { url: `${baseUrl}/api/serp-search` });

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

    for (let i = 0; i < Math.min(results.length, 10); i++) {
      const result = results[i];
      evidence.push({
        id: `serp_${i}`,
        publisher: result.domain || result.source || 'Unknown',
        url: result.link,
        quote: result.snippet || '',
        score: calculateSourceScore(result.domain || result.source),
        type: 'search_result',
        title: '',
        snippet: '',
        source: {
            name: 'Unknown',
            url: '',
            credibility: {
              rating: 'Medium',
              classification: 'Unverified',
              warnings: [],
            },
          }
      });
    }

    const avgScore = evidence.length > 0
      ? evidence.reduce((sum, e) => sum + e.score, 0) / evidence.length
      : 0;

    logger.info(`Phase 2: Found ${evidence.length} results`, { avgScore: avgScore.toFixed(1) });

    return {
      tier: 'pipeline-search',
      success: evidence.length > 0,
      confidence: avgScore,
      evidence,
      processingTime: Date.now() - startTime
    };

  } catch (error: any) {
    logger.warn('Phase 2 failed', { error: error.message });
    return {
      tier: 'pipeline-search',
      success: false,
      confidence: 0,
      evidence: [],
      processingTime: Date.now() - startTime,
      error: error.message
    };
  }
}

async function runPhase3(text: string, existingEvidence: any[], req: VercelRequest, config: any) {
  const startTime = Date.now();
  const evidence: EvidenceItem[] = [];

  try {
    const entities = extractKeyEntities(text);

    if (entities.length === 0) {
      logger.info('No entities for news search');
      return {
        tier: 'specialized-analysis',
        success: false,
        confidence: 0,
        evidence: [],
        processingTime: Date.now() - startTime
      };
    }

    const newsQuery = entities.slice(0, 3).join(' ');
    
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const baseUrl = `${protocol}://${host}`;

    const response = await fetch(`${baseUrl}/api/webz-news-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: newsQuery,
        fromDate: getRecentDate()
      })
    });

    if (!response.ok) {
      logger.warn('News API failed, using SERP fallback');
      return await fallbackNewsSearch(newsQuery, startTime, req, config);
    }

    const data = await response.json();
    const posts = data.posts || [];

    for (let i = 0; i < Math.min(posts.length, 5); i++) {
      const post = posts[i];
      evidence.push({
        id: `news_${i}`,
        publisher: post.author || post.thread?.site || 'News Source',
        url: post.url,
        quote: post.text?.substring(0, 300) || '',
        score: 70,
        type: 'news',
        publishedDate: post.published,
        title: '',
        snippet: '',
        source: {
            name: 'Unknown',
            url: '',
            credibility: {
              rating: 'Medium',
              classification: 'Unverified',
              warnings: [],
            },
          }
      });
    }

    logger.info(`Phase 3: Found ${evidence.length} news articles`);

    return {
      tier: 'specialized-analysis',
      success: evidence.length > 0,
      confidence: 70,
      evidence,
      processingTime: Date.now() - startTime
    };

  } catch (error: any) {
    logger.warn('Phase 3 failed', { error: error.message });
    return {
      tier: 'specialized-analysis',
      success: false,
      confidence: 0,
      evidence: [],
      processingTime: Date.now() - startTime,
      error: error.message
    };
  }
}

async function fallbackNewsSearch(query: string, startTime: number, req: VercelRequest, config: any) {
  try {
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const baseUrl = `${protocol}://${host}`;

    const response = await fetch(`${baseUrl}/api/serp-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `${query} news` })
    });

    if (!response.ok) throw new Error('Fallback failed');

    const data = await response.json();
    const results = (data.organic || [])
      .filter((r: any) => {
        const url = (r.link || '').toLowerCase();
        return url.includes('news') || url.includes('reuters') ||
               url.includes('apnews') || url.includes('bbc');
      })
      .slice(0, 5);

    const evidence = results.map((r: any, i: number) => ({
      id: `news_fallback_${i}`,
      publisher: r.domain || r.source || 'News Source',
      url: r.link,
      quote: r.snippet || '',
      score: 65,
      type: 'news' as const,
      title: '',
      snippet: '',
      source: {
            name: 'Unknown',
            url: '',
            credibility: {
              rating: 'Medium',
              classification: 'Unverified',
              warnings: [],
            },
          }
    }));

    return {
      tier: 'specialized-analysis',
      success: evidence.length > 0,
      confidence: 65,
      evidence,
      processingTime: Date.now() - startTime
    };
  } catch {
    return {
      tier: 'specialized-analysis',
      success: false,
      confidence: 0,
      evidence: [],
      processingTime: Date.now() - startTime
    };
  }
}

async function runPhase4Synthesis(
  text: string,
  evidence: EvidenceItem[],
  context: string,
  tierResults: any[],
  startTime: number,
  config: any
) {
  try {
    const geminiApiKey = config.gemini || process.env.GEMINI_API_KEY;
    const preferredModel = config.geminiModel;

    if (!geminiApiKey || evidence.length === 0) {
      logger.warn('Using statistical fallback');
      return createStatisticalReport(text, evidence, tierResults, startTime);
    }

    const prompt = buildSynthesisPrompt(text, evidence, context);

    logger.info('Synthesizing with Gemini', { model: preferredModel || 'default' });

    const geminiText = await generateTextWithFallback(prompt, {
      apiKey: geminiApiKey,
      model: preferredModel,
      temperature: 0.3,
      maxOutputTokens: 2000,
    });


    if (!geminiText) {
      throw new Error('Empty response from Gemini');
    }

    logger.info('Gemini synthesis successful');

    const synthesis = parseGeminiResponse(geminiText, evidence);

    return {
      id: `fact_check_${Date.now()}`,
      originalText: text,
      final_verdict: synthesis.verdict,
      final_score: synthesis.score,
      reasoning: synthesis.reasoning,
      evidence,
      metadata: {
        method_used: 'tiered-verification',
        processing_time_ms: Date.now() - startTime,
        apis_used: ['google-fact-check', 'serp-api', 'webz-news', 'gemini-ai-fallback'],
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
    logger.error('Synthesis failed', { error: error.message });
    return createStatisticalReport(text, evidence, tierResults, startTime);
  }
}


function buildSynthesisPrompt(text: string, evidence: EvidenceItem[], context: string) {
  const evidenceSummary = evidence.slice(0, 15).map((e, i) =>
    `${i + 1}. ${e.publisher} (${e.score}%) - "${e.quote.substring(0, 200)}"`
  ).join('\n');

  return `You are a professional fact-checker analyzing a claim for ${context} publication.

CLAIM TO VERIFY:
"${text}"

EVIDENCE (${evidence.length} sources):
${evidenceSummary}

Provide:
1. VERDICT: [TRUE, MOSTLY TRUE, MIXED, MOSTLY FALSE, FALSE, UNVERIFIED]
2. SCORE: 0-100
3. REASONING: 2-3 sentences
4. WARNINGS: Concerns or "None"

Format:
VERDICT: [verdict]
SCORE: [number]
REASONING: [explanation]
WARNINGS: [concerns or "None"]`;
}

function parseGeminiResponse(text: string, evidence: EvidenceItem[]) {
  const verdictMatch = text.match(/VERDICT:\s*(.+)/i);
  const scoreMatch = text.match(/SCORE:\s*(\d+)/i);
  const reasoningMatch = text.match(/REASONING:\s*(.+?)(?=WARNINGS:|$)/is);
  const warningsMatch = text.match(/WARNINGS:\s*(.+?)$/is);

  const score = scoreMatch ? parseInt(scoreMatch[1]) :
                evidence.length > 0 ? Math.round(evidence.reduce((s, e) => s + e.score, 0) / evidence.length) : 0;

  return {
    verdict: (verdictMatch?.[1]?.trim() || generateVerdict(score)) as FactVerdict,
    score,
    reasoning: reasoningMatch?.[1]?.trim() || `Based on ${evidence.length} sources with ${score}% avg credibility.`,
    warnings: warningsMatch?.[1]?.trim() !== 'None' ? [warningsMatch?.[1]?.trim()].filter(Boolean) : []
  };
}

function createStatisticalReport(text: string, evidence: EvidenceItem[], tierResults: any[], startTime: number) {
  const avgScore = evidence.length > 0
    ? Math.round(evidence.reduce((sum, e) => sum + e.score, 0) / evidence.length)
    : 0;

  const highCred = evidence.filter(e => e.score >= 75).length;

  return {
    id: `fact_check_${Date.now()}`,
    originalText: text,
    final_verdict: generateVerdict(avgScore),
    final_score: avgScore,
    reasoning: `Analysis based on ${evidence.length} sources:\n- ${highCred} high-credibility (≥75%)\n- Average: ${avgScore}%`,
    evidence,
    metadata: {
      method_used: 'tiered-statistical',
      processing_time_ms: Date.now() - startTime,
      apis_used: ['serp-api', 'webz-news'],
      sources_consulted: {
        total: evidence.length,
        high_credibility: highCred,
        conflicting: 0
      },
      warnings: ['AI synthesis unavailable - statistical analysis used'],
      tier_breakdown: tierResults
    }
  };
}

async function validateCitations(evidence: EvidenceItem[]) {
  if (evidence.length === 0) return [];

  logger.info('Validating citations...');
  
  const validationPromises = evidence.map(async (item) => {
    const { url } = item;
    let accessibility: 'accessible' | 'inaccessible' | 'error' = 'error';
    let isValid = false;

    if (url) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      try {
        const response = await fetch(url, {
          method: 'HEAD',
          signal: controller.signal,
        });
        accessibility = response.ok ? 'accessible' : 'inaccessible';
        isValid = true;
      } catch {
        accessibility = 'inaccessible';
      } finally {
        clearTimeout(timeoutId);
      }
    }

    const { score: credibilityScore, warnings } = calculateCredibilityInternal(url);

    return {
      ...item,
      isValid,
      accessibility,
      credibilityScore,
      warnings,
    };
  });

  return Promise.all(validationPromises);
}

function calculateCredibilityInternal(url: string | null): { score: number; warnings: string[] } {
  const warnings: string[] = [];
  let score = 75;

  if (!url) return { score: 30, warnings: ['Missing URL'] };

  if (url.includes('.gov') || url.includes('.edu')) score += 15;
  else if (url.includes('reuters.com') || url.includes('apnews.com')) score += 10;
  else if (url.includes('wikipedia.org')) {
    score -= 10;
    warnings.push('Wikipedia is user-generated.');
  } else if (url.includes('blogspot.com') || url.includes('wordpress.com')) {
    score -= 25;
    warnings.push('Blog sources less credible.');
  }

  if (url.startsWith('http://')) {
    warnings.push('No HTTPS.');
    score -= 5;
  }

  return { score: Math.max(0, Math.min(100, score)), warnings };
}

function extractSmartQuery(text: string, maxLength: number): string {
  const firstSentence = text.match(/^[^.!?]+[.!?]/)?.[0] || text;
  if (firstSentence.length <= maxLength) return firstSentence.trim();

  const truncated = firstSentence.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return lastSpace > 0 ? truncated.substring(0, lastSpace) : truncated;
}

function extractKeyEntities(text: string): string[] {
  const words = text.split(/\s+/);
  const entities = words
    .filter(w => /^[A-Z][a-z]+/.test(w) && w.length > 3)
    .slice(0, 5);
  return [...new Set(entities)];
}

function getRecentDate(): string {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  return ninetyDaysAgo.toISOString().split('T')[0];
}

function calculateSourceScore(source: string): number {
  const lower = (source || '').toLowerCase();
  if (/reuters|ap\.org|apnews|bbc/i.test(lower)) return 85;
  if (/factcheck|snopes|politifact/i.test(lower)) return 85;
  if (/nytimes|washingtonpost|wsj|theguardian/i.test(lower)) return 75;
  if (/\.gov|\.edu/i.test(lower)) return 80;
  if (/cnn|abc|nbc|cbs/i.test(lower)) return 70;
  return 50;
}

function convertRatingToScore(rating: string): number {
  if (!rating) return 50;
  const lower = rating.toLowerCase();
  if (lower.includes('true')) return 90;
  if (lower.includes('mostly true')) return 75;
  if (lower.includes('mixed')) return 50;
  if (lower.includes('mostly false')) return 25;
  if (lower.includes('false')) return 10;
  return 50;
}

function generateVerdict(score: number): FactVerdict {
  if (score >= 85) return 'TRUE';
  if (score >= 70) return 'MOSTLY TRUE';
  if (score >= 50) return 'MIXED';
  if (score >= 30) return 'MOSTLY FALSE';
  return 'FALSE';
}

function deduplicateEvidence(evidence: EvidenceItem[]): EvidenceItem[] {
  const seen = new Set<string>();
  return evidence.filter(item => {
    const key = item.url || `${item.publisher}-${item.quote.substring(0, 50)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
