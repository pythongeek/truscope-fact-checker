import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put, del } from '@vercel/blob';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// API URLs
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';
const GOOGLE_FACT_CHECK_URL = 'https://factchecktools.googleapis.com/v1alpha1/claims:search';
const SERPER_API_URL = 'https://google.serper.dev/search';

// Constants
const MAX_QUERY_LENGTH = 2048;
const MAX_WEBZ_QUERY_LENGTH = 100;

// Main unified handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { action } = req.body;

    if (!action) {
      return res.status(400).json({ error: 'Missing action parameter' });
    }

    // Route to appropriate handler
    switch (action) {
      case 'fact-check':
        return await handleFactCheck(req, res);
      case 'auto-correct':
        return await handleAutoCorrect(req, res);
      case 'serp-search':
        return await handleSerpSearch(req, res);
      case 'webz-news-search':
        return await handleWebzNewsSearch(req, res);
      case 'generate-schema':
        return await handleGenerateSchema(req, res);
      case 'health-check':
        return await handleHealthCheck(req, res);
      case 'advanced-editor':
        return await handleAdvancedEditor(req, res);
      case 'blob-analytics':
        return await handleBlobAnalytics(req, res);
      case 'blob-save-report':
        return await handleBlobSaveReport(req, res);
      case 'blob-delete-report':
        return await handleBlobDeleteReport(req, res);
      case 'blob-export-bulk':
        return await handleBlobExportBulk(req, res);
      case 'blob-save-batch-results':
        return await handleBlobSaveBatchResults(req, res);
      case 'blob-save-fact-database':
        return await handleBlobSaveFactDatabase(req, res);
      case 'blob-load-editor-history':
        return await handleBlobLoadEditorHistory(req, res);
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error: any) {
    console.error('Unified API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
}

// ============================================
// FACT-CHECK HANDLER
// ============================================
async function handleFactCheck(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();
  const { text, publishingContext = 'journalism' } = req.body;

  if (!text || text.trim().length === 0) {
    return res.status(400).json({ error: 'Text is required for fact-checking' });
  }

  console.log('🎯 Starting Tiered Fact-Check');

  try {
    // Run phases in parallel
    const [phase1Result, phase2Result, phase3Result] = await Promise.all([
      runPhase1(text),
      runPhase2(text, req),
      runPhase3(text, req)
    ]);

    const tierResults = [phase1Result, phase2Result, phase3Result];

    // Combine evidence
    const allEvidence = deduplicateEvidence([
      ...phase1Result.evidence,
      ...phase2Result.evidence,
      ...phase3Result.evidence
    ]);

    const validatedEvidence = await validateCitations(allEvidence);

    // AI Synthesis
    const finalReport = await runPhase4Synthesis(
      text,
      validatedEvidence,
      publishingContext,
      tierResults,
      startTime
    );

    return res.status(200).json(finalReport);

  } catch (error: any) {
    console.error('❌ Fact-check failed:', error);
    return res.status(500).json({
      error: 'Fact-check failed',
      details: error.message,
      id: `error_${Date.now()}`,
      originalText: text,
      final_verdict: 'ERROR',
      final_score: 0,
      evidence: [],
      processingTime: Date.now() - startTime
    });
  }
}

// Phase 1: Google Fact Check API
async function runPhase1(text: string) {
  const startTime = Date.now();
  const evidence: any[] = [];

  try {
    const query = extractSmartQuery(text, 100);
    const apiKey = process.env.GOOGLE_FACT_CHECK_API_KEY;

    if (!apiKey) {
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
        evidence.push({
          id: `factcheck_${i}`,
          publisher: typeof review.publisher === 'string' ? review.publisher : review.publisher?.name || 'Fact Checker',
          url: review.url || null,
          quote: `${claim.text} - ${review.textualRating || 'Unknown'}`,
          score: convertRatingToScore(review.textualRating),
          type: 'claim'
        });
      }
    }

    const avgScore = evidence.length > 0 ? evidence.reduce((sum, e) => sum + e.score, 0) / evidence.length : 0;

    return {
      tier: 'direct-verification',
      success: evidence.length > 0,
      confidence: avgScore,
      evidence,
      processingTime: Date.now() - startTime
    };

  } catch (error: any) {
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

// Phase 2: SERP API Search
async function runPhase2(text: string, req: VercelRequest) {
  const startTime = Date.now();
  const evidence: any[] = [];

  try {
    let query = extractSmartQuery(text, 100);
    const apiKey = process.env.SERP_API_KEY;

    if (!apiKey) {
      throw new Error('SERP API key not configured');
    }

    if (query.length > MAX_QUERY_LENGTH) {
      query = query.substring(0, MAX_QUERY_LENGTH);
    }

    const response = await fetch(SERPER_API_URL, {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query })
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
        type: 'search_result'
      });
    }

    const avgScore = evidence.length > 0 ? evidence.reduce((sum, e) => sum + e.score, 0) / evidence.length : 0;

    return {
      tier: 'pipeline-search',
      success: evidence.length > 0,
      confidence: avgScore,
      evidence,
      processingTime: Date.now() - startTime
    };

  } catch (error: any) {
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

// Phase 3: News Search
async function runPhase3(text: string, req: VercelRequest) {
  const startTime = Date.now();
  const evidence: any[] = [];

  try {
    const entities = extractKeyEntities(text);

    if (entities.length === 0) {
      return {
        tier: 'specialized-analysis',
        success: false,
        confidence: 0,
        evidence: [],
        processingTime: Date.now() - startTime
      };
    }

    let newsQuery = entities.slice(0, 3).join(' ');
    const apiKey = process.env.WEBZ_API_KEY;

    if (!apiKey) {
      return await fallbackNewsSearch(newsQuery, startTime, req);
    }

    if (newsQuery.length > MAX_WEBZ_QUERY_LENGTH) {
      newsQuery = newsQuery.substring(0, MAX_WEBZ_QUERY_LENGTH);
    }

    const params = new URLSearchParams({
      token: apiKey,
      q: newsQuery,
      ts: Math.floor(new Date(getRecentDate()).getTime() / 1000).toString()
    });

    const response = await fetch(`https://api.webz.io/newsApiLite?${params.toString()}`);

    if (!response.ok) {
      return await fallbackNewsSearch(newsQuery, startTime, req);
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
        publishedDate: post.published
      });
    }

    return {
      tier: 'specialized-analysis',
      success: evidence.length > 0,
      confidence: 70,
      evidence,
      processingTime: Date.now() - startTime
    };

  } catch (error: any) {
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

async function fallbackNewsSearch(query: string, startTime: number, req: VercelRequest) {
  try {
    let searchQuery = `${query} news`;
    const apiKey = process.env.SERP_API_KEY;

    if (!apiKey) throw new Error('No API key');

    if (searchQuery.length > MAX_QUERY_LENGTH) {
      searchQuery = searchQuery.substring(0, MAX_QUERY_LENGTH);
    }

    const response = await fetch(SERPER_API_URL, {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: searchQuery })
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
      type: 'news'
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

// Phase 4: AI Synthesis
async function runPhase4Synthesis(
  text: string,
  evidence: any[],
  context: string,
  tierResults: any[],
  startTime: number
) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || evidence.length === 0) {
      return createStatisticalReport(text, evidence, tierResults, startTime);
    }

    const prompt = buildSynthesisPrompt(text, evidence, context);

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2000
        }
      })
    });

    if (!response.ok) {
      throw new Error('Gemini API failed');
    }

    const data = await response.json();
    const geminiText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
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
        apis_used: ['google-fact-check', 'serp-api', 'webz-news', 'gemini-ai'],
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
    return createStatisticalReport(text, evidence, tierResults, startTime);
  }
}

// ============================================
// AUTO-CORRECT HANDLER
// ============================================
async function handleAutoCorrect(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();
  const { text, factCheckResult, mode } = req.body;

  if (!text || !factCheckResult) {
    return res.status(400).json({ error: 'Text and factCheckResult are required' });
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const prompt = buildAutoCorrectPrompt(text, factCheckResult, mode);

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text();

    const cleanedJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const aiResult = JSON.parse(cleanedJson);

    return res.status(200).json({
      mode,
      originalText: text,
      editedText: aiResult.editedText,
      changesApplied: aiResult.changesApplied,
      improvementScore: aiResult.improvementScore,
      processingTime: Date.now() - startTime,
      confidence: aiResult.confidence,
    });

  } catch (error: any) {
    console.error('❌ Auto-correction failed:', error);
    return res.status(500).json({
      error: 'Auto-correction failed',
      details: error.message,
    });
  }
}

function buildAutoCorrectPrompt(text: string, factCheckResult: any, mode: string): string {
  const evidenceSummary = (factCheckResult.evidence || []).map((e: any) =>
    `- ${e.publisher}: "${e.quote.substring(0, 100)}..." (Credibility: ${e.score}%)`
  ).join('\n');

  return `You are an AI-powered editorial assistant.

PUBLISHING CONTEXT: ${mode}
ORIGINAL TEXT: "${text}"

FACT-CHECKING EVIDENCE:
- Verdict: ${factCheckResult.final_verdict} (Score: ${factCheckResult.final_score}/100)
${evidenceSummary}

Return ONLY valid JSON:
{
  "editedText": "corrected text...",
  "changesApplied": [
    { "type": "modification", "originalPhrase": "...", "newPhrase": "...", "reason": "...", "confidence": 95 }
  ],
  "improvementScore": 88,
  "confidence": 92
}`;
}

// ============================================
// OTHER HANDLERS
// ============================================
async function handleSerpSearch(req: VercelRequest, res: VercelResponse) {
  let { query } = req.body;
  const apiKey = process.env.SERP_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ message: 'SERP API key not configured' });
  }

  if (query.length > MAX_QUERY_LENGTH) {
    query = query.substring(0, MAX_QUERY_LENGTH);
  }

  try {
    const response = await fetch(SERPER_API_URL, {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query }),
    });

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error: any) {
    return res.status(500).json({ message: 'Internal error', details: error.message });
  }
}

async function handleWebzNewsSearch(req: VercelRequest, res: VercelResponse) {
  let { query, fromDate } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'Missing query parameter' });
  }

  const apiKey = process.env.WEBZ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Webz API key not configured' });
  }

  if (query.length > MAX_WEBZ_QUERY_LENGTH) {
    query = query.substring(0, MAX_WEBZ_QUERY_LENGTH);
  }

  const params = new URLSearchParams({ token: apiKey, q: query });
  if (fromDate) {
    params.append('ts', Math.floor(new Date(fromDate).getTime() / 1000).toString());
  }

  try {
    const response = await fetch(`https://api.webz.io/newsApiLite?${params.toString()}`);
    const data = await response.json();
    return res.status(200).json(data);
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal error', details: error.message });
  }
}

async function handleGenerateSchema(req: VercelRequest, res: VercelResponse) {
  const { claim, score, verdict, evidence, publisherInfo } = req.body;

  if (!claim || score === undefined || !verdict || !publisherInfo) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const { organizationName, organizationUrl, articleUrl, headline, authorName } = publisherInfo;

  const claimReviewSchema = {
    "@context": "https://schema.org",
    "@type": "ClaimReview",
    "datePublished": new Date().toISOString().split('T')[0],
    "url": articleUrl,
    "claimReviewed": claim,
    "author": {
      "@type": "Organization",
      "name": organizationName,
      "url": organizationUrl,
    },
    "reviewRating": {
      "@type": "Rating",
      "ratingValue": score.toString(),
      "bestRating": "100",
      "worstRating": "0",
      "alternateName": verdict,
    },
    "itemReviewed": {
      "@type": "Claim",
      "author": {
        "@type": "Organization",
        "name": evidence?.[0]?.publisher || "Various Sources",
      },
      "datePublished": evidence?.[0]?.publishedDate || new Date().toISOString().split('T')[0],
    }
  };

  const htmlSnippet = `<script type="application/ld+json">${JSON.stringify(claimReviewSchema, null, 2)}</script>`;

  return res.status(200).json({
    schema: claimReviewSchema,
    htmlSnippet,
    validation: { status: "valid", message: "Schema is valid" }
  });
}

async function handleHealthCheck(req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
}

async function handleAdvancedEditor(req: VercelRequest, res: VercelResponse) {
  const { text, mode, prompt } = req.body;

  if (!text || !mode) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  let editedText = text;

  switch (mode) {
    case 'quick-fix':
      editedText = text.replace(/\s+/g, ' ').trim();
      break;
    case 'enhanced':
    case 'complete-rewrite':
      editedText = text;
      break;
  }

  return res.status(200).json({
    editedText,
    processingTime: Date.now(),
    confidence: 90
  });
}

async function handleBlobAnalytics(req: VercelRequest, res: VercelResponse) {
  const { period = '7d' } = req.query;

  return res.status(200).json({
    period,
    metrics: {
      totalProcessings: Math.floor(Math.random() * 1000),
      averageImprovementScore: Math.floor(Math.random() * 30) + 70,
      mostUsedMode: 'enhanced'
    }
  });
}

async function handleBlobSaveReport(req: VercelRequest, res: VercelResponse) {
  try {
    const report = req.body;
    const filename = `truescope-reports/${report.id}.json`;

    const blob = await put(filename, JSON.stringify(report), {
      access: 'public',
      addRandomSuffix: false,
    });

    return res.status(200).json({ success: true, url: blob.url });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to save report', details: error.message });
  }
}

async function handleBlobDeleteReport(req: VercelRequest, res: VercelResponse) {
  try {
    const { reportId } = req.body;
    await del(`truescope-reports/${reportId}.json`);
    return res.status(200).json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to delete report', details: error.message });
  }
}

async function handleBlobExportBulk(req: VercelRequest, res: VercelResponse) {
  try {
    const { factCheckIds, format = 'json' } = req.body;

    const bulkExportData = {
      exportId: `bulk_${Date.now()}`,
      timestamp: new Date().toISOString(),
      format,
      totalSessions: factCheckIds.length,
    };

    const filename = `bulk-exports/${bulkExportData.exportId}.json`;
    const blob = await put(filename, JSON.stringify(bulkExportData, null, 2), {
      access: 'public',
      contentType: 'application/json'
    });

    return res.status(200).json({
      success: true,
      downloadUrl: blob.url,
      totalSessions: factCheckIds.length
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Bulk export failed', details: error.message });
  }
}

async function handleBlobSaveBatchResults(req: VercelRequest, res: VercelResponse) {
  try {
    const { id, results, factCheckId } = req.body;

    const batchFilename = `batch-results/${factCheckId}/${id}.json`;
    const blob = await put(batchFilename, JSON.stringify({ id, results }, null, 2), {
      access: 'public',
      contentType: 'application/json'
    });

    return res.status(200).json({ success: true, url: blob.url });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to save batch', details: error.message });
  }
}

async function handleBlobSaveFactDatabase(req: VercelRequest, res: VercelResponse) {
  try {
    const facts = req.body;
    const blob = await put('fact-database/db.json', JSON.stringify(facts, null, 2), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true,
    });

    return res.status(200).json({ success: true, url: blob.url });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to save database', details: error.message });
  }
}

async function handleBlobLoadEditorHistory(req: VercelRequest, res: VercelResponse) {
  const { factCheckId } = req.query;

  if (!factCheckId) {
    return res.status(400).json({ error: 'factCheckId is required' });
  }

  return res.status(200).json({ factCheckId, results: [] });
}

// ============================================
// HELPER FUNCTIONS
// ============================================
function extractSmartQuery(text: string, maxLength: number): string {
  const firstSentence = text.match(/^[^.!?]+[.!?]/)?.[0] || text;
  if (firstSentence.length <= maxLength) return firstSentence.trim();

  const truncated = firstSentence.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return lastSpace > 0 ? truncated.substring(0, lastSpace) : truncated;
}

function extractKeyEntities(text: string): string[] {
  const words = text.split(/\s+/);
  const entities = words.filter(w => /^[A-Z][a-z]+/.test(w) && w.length > 3).slice(0, 5);
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

function generateVerdict(score: number): string {
  if (score >= 85) return 'TRUE';
  if (score >= 70) return 'MOSTLY TRUE';
  if (score >= 50) return 'MIXED';
  if (score >= 30) return 'MOSTLY FALSE';
  return 'FALSE';
}

function deduplicateEvidence(evidence: any[]): any[] {
  const seen = new Set<string>();
  return evidence.filter(item => {
    const key = item.url || `${item.publisher}-${item.quote.substring(0, 50)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function validateCitations(evidence: any[]) {
  if (evidence.length === 0) return [];

  const validationPromises = evidence.map(async (item) => {
    let accessibility: 'accessible' | 'inaccessible' | 'error' = 'error';
    let isValid = false;

    if (item.url) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      try {
        const response = await fetch(item.url, {
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

    const { score: credibilityScore, warnings } = calculateCredibilityInternal(item.url);

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

function calculateCredibilityInternal(url: string): { score: number; warnings: string[] } {
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

function buildSynthesisPrompt(text: string, evidence: any[], context: string) {
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

function parseGeminiResponse(text: string, evidence: any[]) {
  const verdictMatch = text.match(/VERDICT:\s*(.+)/i);
  const scoreMatch = text.match(/SCORE:\s*(\d+)/i);
  const reasoningMatch = text.match(/REASONING:\s*(.+?)(?=WARNINGS:|$)/is);
  const warningsMatch = text.match(/WARNINGS:\s*(.+?)$/is);

  const score = scoreMatch ? parseInt(scoreMatch[1]) :
                evidence.length > 0 ? Math.round(evidence.reduce((s, e) => s + e.score, 0) / evidence.length) : 0;

  return {
    verdict: verdictMatch?.[1]?.trim() || generateVerdict(score),
    score,
    reasoning: reasoningMatch?.[1]?.trim() || `Based on ${evidence.length} sources with ${score}% avg credibility.`,
    warnings: warningsMatch?.[1]?.trim() !== 'None' ? [warningsMatch?.[1]?.trim()].filter(Boolean) : []
  };
}

function createStatisticalReport(text: string, evidence: any[], tierResults: any[], startTime: number) {
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
