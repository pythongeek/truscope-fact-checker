// api/fact-check.ts - REWRITTEN FOR INTELLIGENT ORCHESTRATION
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Vercel timeout configuration
export const config = {
  maxDuration: 10, // Hobby tier limit
};

// --- CONSTANTS ---
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const SERPER_API_URL = 'https://google.serper.dev/search';
const WEBZ_API_URL = 'https://api.webz.io/newsApiLite';
const API_TIMEOUT = 4000; // 4-second timeout for individual API calls

// --- KEY THRESHOLDS ---
const MIN_EVIDENCE_FOR_SYNTHESIS = 3;
const HIGH_CONFIDENCE_THRESHOLD = 85;
const ESCALATION_CONFIDENCE_THRESHOLD = 70;

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

interface TierResult {
    tier: string;
    success: boolean;
    confidence: number;
    evidence: Evidence[];
    processingTime: number;
    query: string;
    summary: string;
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
    tierBreakdown: TierResult[];
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
    }, API_TIMEOUT * 2); // Give Gemini more time

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

// --- MAIN HANDLER (INTELLIGENT ORCHESTRATOR) ---
export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const startTime = Date.now();
    const { text, publishingContext = 'journalism', config = {} } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return res.status(400).json({ error: 'Text is required for fact-checking.' });
    }

    logger.info('🚀 Starting Intelligent Fact-Check Orchestration', { textLength: text.length });

    try {
        const tierResults: TierResult[] = [];
        let allEvidence: Evidence[] = [];
        let currentQuery = extractSmartQuery(text, 120);

        // --- Phase 1: Broad Web Search (SERP) ---
        const phase1Result = await runWebSearch(currentQuery);
        tierResults.push(phase1Result);
        allEvidence = mergeEvidence(allEvidence, phase1Result.evidence);

        // --- Dynamic Escalation Logic ---
        let escalationReason = '';
        if (phase1Result.confidence < HIGH_CONFIDENCE_THRESHOLD && allEvidence.length > 0) {
            if (phase1Result.confidence < ESCALATION_CONFIDENCE_THRESHOLD) {
                escalationReason = `Initial confidence is low (${phase1Result.confidence.toFixed(0)}%). Seeking corroboration from news sources.`;
                currentQuery = refineQueryFromEvidence(text, allEvidence);
            } else {
                escalationReason = `Confidence is moderate (${phase1Result.confidence.toFixed(0)}%). Verifying with targeted news search.`;
                currentQuery = refineQueryFromEvidence(text, allEvidence, true);
            }
            logger.info('🧠 Dynamic Escalation', { reason: escalationReason, newQuery: currentQuery });

            // --- Phase 2: Targeted News Search (Webz) ---
            const phase2Result = await runNewsSearch(currentQuery);
            tierResults.push(phase2Result);
            allEvidence = mergeEvidence(allEvidence, phase2Result.evidence);
        } else if (allEvidence.length === 0) {
             logger.warn('Initial search yielded no results. Attempting broader news search.');
             const phase2Result = await runNewsSearch(currentQuery);
             tierResults.push(phase2Result);
             allEvidence = mergeEvidence(allEvidence, phase2Result.evidence);
        }


        // --- Phase 3: AI-Powered Synthesis (Gemini) ---
        const finalReport = await runSynthesis(
            text,
            allEvidence,
            publishingContext,
            tierResults,
            startTime,
            config
        );

        logger.info('✅ Fact-Check Complete', {
            finalScore: finalReport.finalScore,
            verdict: finalReport.finalVerdict,
            evidenceCount: finalReport.evidence.length
        });

        return res.status(200).json(finalReport);

    } catch (error: any) {
        logger.error('Orchestration failed unexpectedly', { errorMessage: error.message, stack: error.stack });
        return res.status(500).json({ error: 'An internal server error occurred during fact-check orchestration.' });
    }
}

// --- SEARCH PHASES ---
async function runWebSearch(query: string): Promise<TierResult> {
    const startTime = Date.now();
    const apiKey = process.env.SERP_API_KEY;
    if (!apiKey) {
        logger.error("SERP_API_KEY is not configured.");
        return { tier: 'web-search', success: false, confidence: 0, evidence: [], query, summary: "SERP API key not configured.", processingTime: Date.now() - startTime };
    }

    try {
        const response = await fetchWithTimeout(SERPER_API_URL, {
            method: 'POST',
            headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ q: query, num: 15 }),
        }, API_TIMEOUT);

        if (!response.ok) throw new Error(`SERP API HTTP error: ${response.status}`);
        const data = await response.json();
        const evidence = mapSerpResultsToEvidence(data.organic || [], data.knowledgeGraph);
        const confidence = calculateTierConfidence(evidence);

        const summary = `Found ${evidence.length} web results with an average confidence of ${confidence.toFixed(0)}%.`;
        logger.info('✅ Phase 1 (Web Search) Complete', { summary });
        return { tier: 'web-search', success: true, confidence, evidence, query, summary, processingTime: Date.now() - startTime };

    } catch (error: any) {
        logger.warn('Phase 1 (Web Search) Failed', { error: error.message });
        return { tier: 'web-search', success: false, confidence: 0, evidence: [], query, summary: error.message, processingTime: Date.now() - startTime };
    }
}

async function runNewsSearch(query: string): Promise<TierResult> {
    const startTime = Date.now();
    const apiKey = process.env.WEBZ_API_KEY;
    if (!apiKey) {
        logger.error("WEBZ_API_KEY is not configured.");
        return { tier: 'news-analysis', success: false, confidence: 0, evidence: [], query, summary: "Webz API key not configured.", processingTime: Date.now() - startTime };
    }

    try {
        const params = new URLSearchParams({ token: apiKey, q: query, size: '15', sort: 'relevancy' });
        const response = await fetchWithTimeout(`${WEBZ_API_URL}?${params.toString()}`, { method: 'GET' }, API_TIMEOUT);

        if (!response.ok) throw new Error(`Webz API HTTP error: ${response.status}`);
        const data = await response.json();
        const evidence = mapNewsResultsToEvidence(data.posts || []);
        const confidence = calculateTierConfidence(evidence);

        const summary = `Found ${evidence.length} news articles with an average confidence of ${confidence.toFixed(0)}%.`;
        logger.info('✅ Phase 2 (News Search) Complete', { summary });
        return { tier: 'news-analysis', success: true, confidence, evidence, query, summary, processingTime: Date.now() - startTime };

    } catch (error: any) {
        logger.warn('Phase 2 (News Search) Failed', { error: error.message });
        return { tier: 'news-analysis', success: false, confidence: 0, evidence: [], query, summary: error.message, processingTime: Date.now() - startTime };
    }
}

// --- EVIDENCE MAPPERS ---
function mapSerpResultsToEvidence(results: any[] = [], knowledgeGraph?: any): Evidence[] {
    const evidence: Evidence[] = [];
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
            type: 'official_source',
            source: {
                name: 'Google Knowledge Graph',
                url: 'https://google.com',
                credibility: { rating: 'High', classification: 'Knowledge Graph', warnings: [] }
            }
        });
    }

    const mappedResults = results.slice(0, 10).map((result: any, index: number): Evidence | null => {
        if (!result.link) return null;
        const domain = extractDomain(result.link);
        const credScore = calculateSourceScore(domain);
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
            type: 'search_result',
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
            type: 'news',
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

// --- SCORING & CONFIDENCE ---
function calculateTierConfidence(evidence: Evidence[]): number {
    if (evidence.length === 0) return 0;
    const avgCredibility = evidence.reduce((sum, e) => sum + e.credibilityScore, 0) / evidence.length;
    const highCredCount = evidence.filter(e => e.credibilityScore >= 85).length;
    const qualityBonus = Math.min(30, highCredCount * 10);
    return Math.min(100, (avgCredibility * 0.7) + qualityBonus);
}

function calculateNewsSourceScore(domain: string, post: any): number {
    const baseScore = calculateSourceScore(domain);
    if (post.published) {
        const daysOld = (Date.now() - new Date(post.published).getTime()) / (1000 * 60 * 60 * 24);
        if (daysOld < 7) return Math.min(100, baseScore + 5);
        if (daysOld < 30) return Math.min(100, baseScore + 3);
    }
    if (post.author && post.author !== 'Unknown') {
        return Math.min(100, baseScore + 2);
    }
    return baseScore;
}

function calculateSourceScore(domain: string): number {
    const d = domain.toLowerCase();
    if (['reuters.com', 'apnews.com', 'ap.org'].some(s => d.includes(s))) return 98;
    if (['bbc.com', 'bbc.co.uk'].some(s => d.includes(s))) return 95;
    if (['pbs.org', 'npr.org'].some(s => d.includes(s))) return 94;
    if (['factcheck.org', 'snopes.com', 'politifact.com'].some(s => d.includes(s))) return 92;
    if (['nytimes.com', 'washingtonpost.com', 'wsj.com'].some(s => d.includes(s))) return 88;
    if (['theguardian.com', 'economist.com'].some(s => d.includes(s))) return 87;
    if (d.includes('.gov')) return 90;
    if (d.includes('.edu')) return 85;
    if (d.includes('who.int') || d.includes('un.org')) return 93;
    if (['nature.com', 'science.org', 'scientificamerican.com', 'pubmed'].some(s => d.includes(s))) return 85;
    return 60;
}

// --- PHASE 4: SYNTHESIS ---
async function runSynthesis(
    text: string,
    evidence: Evidence[],
    context: string,
    tierResults: TierResult[],
    startTime: number,
    config: any
): Promise<FactCheckReport> {

    const geminiApiKey = config.gemini || process.env.GEMINI_API_KEY;
    const weightedScore = calculateWeightedScore(tierResults, evidence);

    if (!geminiApiKey || evidence.length < MIN_EVIDENCE_FOR_SYNTHESIS) {
        if (!geminiApiKey) logger.warn('Synthesis unavailable: Gemini API key not provided.');
        if (evidence.length < MIN_EVIDENCE_FOR_SYNTHESIS) logger.warn(`Synthesis skipped: Insufficient evidence (${evidence.length} < ${MIN_EVIDENCE_FOR_SYNTHESIS}).`);
        return createEnhancedStatisticalReport(text, evidence, tierResults, startTime, weightedScore);
    }

    try {
        const prompt = buildSynthesisPrompt(text, evidence, context);
        const geminiText = await callGeminiAPI(prompt, geminiApiKey, config.geminiModel || 'gemini-1.5-flash-latest');

        if (!geminiText) throw new Error('Empty response from Gemini');

        const synthesis = parseGeminiResponse(geminiText, evidence, weightedScore);
        const finalScore = Math.round((synthesis.score * 0.6) + (weightedScore * 0.4));

        return {
            id: `fact_check_${Date.now()}`,
            originalText: text,
            finalVerdict: synthesis.verdict,
            finalScore: finalScore,
            reasoning: synthesis.reasoning,
            evidence,
            claimVerifications: [],
            scoreBreakdown: {
                finalScoreFormula: 'AI Synthesis (60%) + Evidence Score (40%)',
                metrics: [
                    { name: 'Web Search Quality', score: tierResults.find(t=>t.tier==='web-search')?.confidence || 0, weight: 0.4, description: 'Credibility of web sources', reasoning: `${tierResults.find(t=>t.tier==='web-search')?.evidence.length || 0} sources`},
                    { name: 'News Coverage', score: tierResults.find(t=>t.tier==='news-analysis')?.confidence || 0, weight: 0.4, description: 'Credibility of news articles', reasoning: `${tierResults.find(t=>t.tier==='news-analysis')?.evidence.length || 0} articles`},
                    { name: 'AI Analysis', score: synthesis.score, weight: 0.6, description: 'AI-driven synthesis of all evidence', reasoning: 'Synthesized from source reputation and consistency' }
                ]
            },
            metadata: {
                methodUsed: 'intelligent-orchestration-synthesis',
                processingTimeMs: Date.now() - startTime,
                apisUsed: tierResults.filter(t => t.success).map(t => t.tier).concat(['gemini-ai']),
                sourcesConsulted: {
                    total: evidence.length,
                    highCredibility: evidence.filter(e => e.credibilityScore >= 80).length,
                    conflicting: 0
                },
                warnings: synthesis.warnings,
                tierBreakdown: tierResults
            }
        };
    } catch (error: any) {
        logger.error('Synthesis failed, falling back to statistical report', { errorMessage: error.message });
        return createEnhancedStatisticalReport(text, evidence, tierResults, startTime, weightedScore);
    }
}

// --- STATISTICAL FALLBACK REPORT ---
function createEnhancedStatisticalReport(
    text: string,
    evidence: Evidence[],
    tierResults: TierResult[],
    startTime: number,
    weightedScore: number,
    customReasoning?: string
): FactCheckReport {
    const highCred = evidence.filter(e => e.credibilityScore >= 80).length;
    const reasoning = customReasoning || buildStatisticalReasoning(evidence, weightedScore, highCred);

    return {
        id: `fact_check_${Date.now()}`,
        originalText: text,
        finalVerdict: generateVerdictFromScore(weightedScore, evidence),
        finalScore: weightedScore,
        reasoning,
        evidence,
        claimVerifications: [],
        scoreBreakdown: { /* ... */ } as any,
        metadata: {
            methodUsed: 'tiered-statistical-analysis',
            processingTimeMs: Date.now() - startTime,
            apisUsed: tierResults.filter(t => t.success).map(t => t.tier),
            sourcesConsulted: { total: evidence.length, highCredibility: highCred, conflicting: 0 },
            warnings: ['AI synthesis was unavailable; this report is based on statistical analysis of sources.'],
            tierBreakdown: tierResults
        }
    };
}

function buildStatisticalReasoning(evidence: Evidence[], finalScore: number, highCred: number): string {
    if (evidence.length === 0) {
        return "No evidence found to verify this claim. Further investigation is needed.";
    }
    let reasoning = `Based on analysis of ${evidence.length} sources, the claim has a reliability score of ${finalScore}%. `;
    if (highCred > 0) {
        reasoning += `The analysis includes ${highCred} high-credibility source${highCred > 1 ? 's' : ''}. `;
    }
    if (finalScore >= 85) {
        reasoning += "The claim appears to be well-supported by reliable sources.";
    } else if (finalScore >= 70) {
        reasoning += "The claim has moderate support but may lack full verification from top-tier sources.";
    } else {
        reasoning += "There is insufficient reliable evidence to support this claim.";
    }
    return reasoning;
}

// --- SYNTHESIS PROMPT & PARSING ---
function buildSynthesisPrompt(text: string, evidence: Evidence[], context: string): string {
    const evidenceSummary = evidence.slice(0, 15).map((e, i) => {
        const credRating = e.credibilityScore >= 80 ? 'HIGH' : e.credibilityScore >= 60 ? 'MED' : 'LOW';
        return `${i + 1}. [${credRating}-${e.credibilityScore}%] ${e.publisher}: "${(e.quote || e.snippet || '').substring(0, 200)}..."`;
    }).join('\n');

    return `As a professional fact-checker for a ${context} publication, analyze the following claim based *only* on the evidence provided.

CLAIM: "${text}"

EVIDENCE (${evidence.length} sources):
${evidenceSummary}

Your Task: Provide a concise, professional analysis in this EXACT format. Do not add any extra text or formatting.

VERDICT: [TRUE, FALSE, MIXED, UNVERIFIED, MISLEADING]
SCORE: [0-100]
REASONING: [2-3 sentences explaining your verdict and score based on the evidence's quality and consistency.]
WARNINGS: [Note any concerns like source quality or contradictions. If none, write "None"]`;
}

function parseGeminiResponse(text: string, evidence: Evidence[], weightedScore: number): { verdict: FactVerdict; score: number; reasoning: string; warnings: string[] } {
    const verdictMatch = text.match(/VERDICT:\s*(TRUE|FALSE|MIXED|UNVERIFIED|MISLEADING)/i);
    const scoreMatch = text.match(/SCORE:\s*(\d+)/i);
    const reasoningMatch = text.match(/REASONING:\s*(.+?)(?=WARNINGS:|$)/is);
    const warningsMatch = text.match(/WARNINGS:\s*(.+)/is);

    const aiScore = scoreMatch ? parseInt(scoreMatch[1], 10) : weightedScore;
    const verdict = verdictMatch ? (verdictMatch[1].toUpperCase() as FactVerdict) : generateVerdictFromScore(aiScore, evidence);
    const reasoning = reasoningMatch?.[1]?.trim() || "AI analysis could not be parsed. Verdict based on statistical data.";
    const warnings: string[] = [];
    if (warningsMatch && warningsMatch[1].toLowerCase().trim() !== 'none') {
        warnings.push(warningsMatch[1].trim());
    }
    if (evidence.length < 3) {
        warnings.push('Limited number of sources available for verification.');
    }

    return { verdict, score: aiScore, reasoning, warnings };
}

// --- UTILITY FUNCTIONS ---
function mergeEvidence(existing: Evidence[], newEvidence: Evidence[]): Evidence[] {
    const evidenceMap = new Map<string, Evidence>();
    [...existing, ...newEvidence].forEach(e => {
        if (e.url) {
            evidenceMap.set(e.url, e);
        }
    });
    return Array.from(evidenceMap.values());
}


function refineQueryFromEvidence(originalText: string, evidence: Evidence[], targeted = false): string {
    const keyEntities = new Set(extractKeyEntities(originalText));
    evidence.forEach(e => {
        extractKeyEntities(e.title).forEach(entity => keyEntities.add(entity));
    });

    const queryTerms = [...keyEntities].slice(0, 5);
    if (targeted) {
        const bestSnippet = evidence.sort((a, b) => b.credibilityScore - a.credibilityScore)[0]?.snippet;
        if (bestSnippet) {
            const phrase = bestSnippet.split(/[.!?]/)[0]; // Use the first sentence
            if (phrase.length > 10) {
                 queryTerms.push(`"${phrase}"`);
            }
        }
    }
    return queryTerms.join(' ');
}

function extractSmartQuery(text: string, maxLength: number): string {
    const cleaned = text.replace(/\s+/g, ' ').trim();
    const firstSentence = cleaned.match(/^[^.!?]+[.!?]/)?.[0] || cleaned;
    const trimmed = firstSentence.trim();
    if (trimmed.length <= maxLength) return trimmed;
    const truncated = trimmed.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    return lastSpace > 0 ? truncated.substring(0, lastSpace) : truncated;
}

function extractKeyEntities(text: string): string[] {
    const words = text.replace(/[^\w\s]/g, '').split(/\s+/);
    const entities = words.filter(w => /^[A-Z]/.test(w) && w.length > 3 && !/^(The|And|But|For)$/.test(w));
    return [...new Set(entities)].slice(0, 5);
}

function extractDomain(url: string): string {
    try {
        return new URL(url).hostname.replace('www.', '');
    } catch {
        return url.split('/')[2]?.replace('www.', '') || url;
    }
}

function classifySource(domain: string): string {
    const d = domain.toLowerCase();
    if (d.includes('.gov')) return 'Government Source';
    if (d.includes('.edu')) return 'Academic Institution';
    if (['reuters', 'apnews', 'bbc'].some(s => d.includes(s))) return 'News Agency';
    if (['factcheck', 'snopes', 'politifact'].some(s => d.includes(s))) return 'Fact-Checking Organization';
    return 'Web Source';
}

function getSourceWarnings(domain: string, score: number): string[] {
    const warnings: string[] = [];
    if (score < 60) warnings.push('Low credibility source');
    if (domain.includes('blog')) warnings.push('Potential opinion or blog content');
    return warnings;
}

function calculateRelevanceScore(position?: number, snippet?: string): number {
    let score = 70;
    if (position && position <= 3) score += 15;
    if (position && position <= 10) score += 5;
    if (snippet && snippet.length > 150) score += 5;
    return Math.min(100, score);
}

function extractDateFromSnippet(snippet?: string): string | undefined {
    if (!snippet) return undefined;
    const match = snippet.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}\b/i);
    return match ? new Date(match[0]).toISOString() : undefined;
}

function generateVerdictFromScore(score: number, evidence: Evidence[]): FactVerdict {
    const highQualitySources = evidence.filter(e => e.credibilityScore >= 80).length;
    if (score >= 85 && highQualitySources >= 2) return 'TRUE';
    if (score >= 70 && evidence.length >= 3) return 'MIXED';
    if (score >= 50) return 'MIXED';
    if (score >= 30) return 'MISLEADING';
    if (score >= 15) return 'FALSE';
    return 'UNVERIFIED';
}

function calculateWeightedScore(tierResults: TierResult[], evidence: Evidence[]): number {
    const webSearch = tierResults.find(t=>t.tier==='web-search');
    const newsSearch = tierResults.find(t=>t.tier==='news-analysis');

    const webScore = webSearch?.success ? webSearch.confidence : 0;
    const newsScore = newsSearch?.success ? newsSearch.confidence : 0;
   
    let finalScore;

    if (webScore > 0 && newsScore > 0) {
        finalScore = (webScore * 0.5) + (newsScore * 0.5);
    } else {
        finalScore = webScore > 0 ? webScore : newsScore;
    }
    
    // If we have very few sources, cap the score to reflect uncertainty
    if (evidence.length < 3) {
        return Math.min(65, Math.round(finalScore));
    }

    return Math.round(finalScore);
}
