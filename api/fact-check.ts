// api/fact-check.ts - FINAL CORRECTED VERSION WITH ALL FUNCTIONS AND TYPE DEFINITIONS
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Vercel timeout configuration
export const config = {
  maxDuration: 10, // Hobby tier limit
};

// --- CONSTANTS ---
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const SERPER_API_URL = 'https://google.serper.dev/search';
const WEBZ_API_URL = 'https://api.webz.io/newsApiLite';
const API_TIMEOUT = 4000;

// --- KEY THRESHOLDS ---
const MIN_EVIDENCE_FOR_SYNTHESIS = 3;
const ESCALATION_CONFIDENCE_THRESHOLD = 75;

// --- INLINE TYPE DEFINITIONS (Corrected) ---
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
  metadata: {
    // FIX: Added 'methodUsed' to the type definition
    methodUsed: string;
    processingTimeMs: number;
    apisUsed: string[];
    sourcesConsulted: {
      total: number;
      highCredibility: number;
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

// --- MAIN HANDLER (HYBRID ORCHESTRATOR) ---
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
    const { text, publishingContext = 'journalism', config = {}, clientSideResults = {} } = req.body;

    if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'Text is required.' });
    }

    logger.info('🚀 Starting Hybrid Fact-Check Orchestration', { textLength: text.length });

    try {
        const tierResults: TierResult[] = [];
        let allEvidence: Evidence[] = [];
        let currentQuery = extractSmartQuery(text, 120);

        // Phase 1: Ingest Client-Side Google Fact Check Results
        if (clientSideResults?.evidence?.length > 0) {
            const clientTier = processClientSideResults(clientSideResults);
            tierResults.push(clientTier);
            allEvidence = mergeEvidence(allEvidence, clientTier.evidence);
            logger.info('✅ Phase 1 (Client-Side) Complete', { summary: clientTier.summary });
        } else {
             logger.warn('Phase 1 (Client-Side) Skipped', { reason: 'No evidence provided from client.'});
        }

        // Phase 2: Broad Web Search (SERP)
        const phase2Result = await runWebSearch(currentQuery);
        tierResults.push(phase2Result);
        allEvidence = mergeEvidence(allEvidence, phase2Result.evidence);

        const confidenceAfterWeb = calculateOverallConfidence(allEvidence);

        // Dynamic Escalation to News Search
        if (confidenceAfterWeb < ESCALATION_CONFIDENCE_THRESHOLD) {
            const escalationReason = `Confidence after web search is low (${confidenceAfterWeb.toFixed(0)}%). Escalating to news search.`;
            const refinedQuery = refineQueryFromEvidence(text, allEvidence, true);
            logger.info('🧠 Dynamic Escalation', { reason: escalationReason, newQuery: refinedQuery });

            const phase3Result = await runNewsSearch(refinedQuery, text);
            tierResults.push(phase3Result);
            allEvidence = mergeEvidence(allEvidence, phase3Result.evidence);
        }

        // Final Phase: AI-Powered Synthesis
        const finalReport = await runSynthesis(text, allEvidence, publishingContext, tierResults, startTime, config);

        logger.info('✅ Fact-Check Complete', {
            finalScore: finalReport.finalScore,
            verdict: finalReport.finalVerdict,
            evidenceCount: finalReport.evidence.length
        });

        return res.status(200).json(finalReport);

    } catch (error: any) {
        logger.error('Orchestration failed', { errorMessage: error.message, stack: error.stack });
        return res.status(500).json({ error: 'An internal server error occurred.' });
    }
}

// --- TIER PROCESSING & SEARCH PHASES ---
function processClientSideResults(clientResults: any): TierResult {
    const evidence = (clientResults.evidence || []).map((e: any) => ({...e})); // Defensive copy
    const confidence = calculateTierConfidence(evidence);
    return {
        tier: 'direct-verification',
        success: evidence.length > 0,
        confidence,
        evidence,
        query: clientResults.query || 'N/A (Client-Side)',
        summary: `Received ${evidence.length} pre-vetted results from client.`,
        processingTime: clientResults.processingTime || 0,
    };
}

async function runWebSearch(query: string): Promise<TierResult> {
    const startTime = Date.now();
    const apiKey = process.env.SERP_API_KEY;
    if (!apiKey) {
        logger.error("SERP_API_KEY is not configured.");
        return { tier: 'web-search', success: false, confidence: 0, evidence: [], query, summary: "SERP API key missing.", processingTime: Date.now() - startTime };
    }
    try {
        const response = await fetchWithTimeout(SERPER_API_URL, {
            method: 'POST',
            headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ q: query, num: 15 }),
        }, API_TIMEOUT);
        if (!response.ok) throw new Error(`SERP API returned status ${response.status}`);
        const data = await response.json();
        const evidence = mapSerpResultsToEvidence(data.organic || [], data.knowledgeGraph);
        const confidence = calculateTierConfidence(evidence);
        const summary = `Found ${evidence.length} web results with a confidence of ${confidence.toFixed(0)}%.`;
        logger.info('✅ Phase 2 (Web Search) Complete', { summary });
        return { tier: 'web-search', success: evidence.length > 0, confidence, evidence, query, summary, processingTime: Date.now() - startTime };
    } catch (error: any) {
        logger.warn('Phase 2 (Web Search) Failed', { error: error.message });
        return { tier: 'web-search', success: false, confidence: 0, evidence: [], query, summary: error.message, processingTime: Date.now() - startTime };
    }
}

async function runNewsSearch(query: string, fallbackQuery: string): Promise<TierResult> {
    const startTime = Date.now();
    const apiKey = process.env.WEBZ_API_KEY;
    if (!apiKey) {
        logger.error("WEBZ_API_KEY is not configured.");
        return { tier: 'news-analysis', success: false, confidence: 0, evidence: [], query, summary: "Webz API key missing.", processingTime: Date.now() - startTime };
    }
    
    let activeQuery = query;
    try {
        let evidence = await fetchNews(activeQuery, apiKey);

        if (evidence.length === 0 && query !== fallbackQuery) {
            logger.warn('Refined news query failed. Falling back to broader query.', { refinedQuery: query });
            activeQuery = extractSmartQuery(fallbackQuery, 120);
            evidence = await fetchNews(activeQuery, apiKey);
        }

        const confidence = calculateTierConfidence(evidence);
        const summary = `Found ${evidence.length} news articles with a confidence of ${confidence.toFixed(0)}%.`;
        logger.info('✅ Phase 3 (News Search) Complete', { summary });
        return { tier: 'news-analysis', success: evidence.length > 0, confidence, evidence, query: activeQuery, summary, processingTime: Date.now() - startTime };

    } catch (error: any) {
        logger.warn('Phase 3 (News Search) Failed', { error: error.message });
        return { tier: 'news-analysis', success: false, confidence: 0, evidence: [], query: activeQuery, summary: error.message, processingTime: Date.now() - startTime };
    }
}

async function fetchNews(query: string, apiKey: string): Promise<Evidence[]> {
    const params = new URLSearchParams({ token: apiKey, q: query, size: '15', sort: 'relevancy' });
    const response = await fetchWithTimeout(`${WEBZ_API_URL}?${params.toString()}`, { method: 'GET' }, API_TIMEOUT);
    if (!response.ok) throw new Error(`Webz API returned status ${response.status}`);
    const data = await response.json();
    return mapNewsResultsToEvidence(data.posts || []);
}

// --- AI SYNTHESIS & REPORTING ---
async function runSynthesis(text: string, evidence: Evidence[], context: string, tierResults: TierResult[], startTime: number, config: any): Promise<FactCheckReport> {
    const geminiApiKey = config.gemini || process.env.GEMINI_API_KEY;
    const finalWeightedScore = calculateOverallConfidence(evidence);

    if (!geminiApiKey || evidence.length < MIN_EVIDENCE_FOR_SYNTHESIS) {
        if (!geminiApiKey) logger.warn('Synthesis unavailable: Gemini API key not configured.');
        if (evidence.length < MIN_EVIDENCE_FOR_SYNTHESIS) logger.warn(`Synthesis skipped: Insufficient evidence (${evidence.length} < ${MIN_EVIDENCE_FOR_SYNTHESIS}).`);
        return createEnhancedStatisticalReport(text, evidence, tierResults, startTime, finalWeightedScore);
    }

    try {
        const prompt = buildSynthesisPrompt(text, evidence, context); // ERROR WAS HERE
        const geminiText = await callGeminiAPI(prompt, geminiApiKey, config.geminiModel || 'gemini-1.5-flash-latest');
        if (!geminiText) throw new Error('Empty response from Gemini');

        const synthesis = parseGeminiResponse(geminiText, evidence, finalWeightedScore);
        const finalScore = Math.round((synthesis.score * 0.6) + (finalWeightedScore * 0.4));

        return {
            id: `fact_check_${Date.now()}`,
            originalText: text,
            finalVerdict: synthesis.verdict,
            finalScore,
            reasoning: synthesis.reasoning,
            evidence,
            metadata: {
                methodUsed: 'hybrid-orchestration-synthesis', // ERROR WAS HERE
                processingTimeMs: Date.now() - startTime,
                apisUsed: tierResults.filter(t => t.success).map(t => t.tier).concat(['gemini-ai']),
                sourcesConsulted: {
                    total: evidence.length,
                    highCredibility: evidence.filter(e => e.credibilityScore >= 80).length,
                },
                warnings: synthesis.warnings,
                tierBreakdown: tierResults
            }
        };
    } catch (error: any) {
        logger.error('Synthesis failed, falling back to statistical report', { errorMessage: error.message });
        return createEnhancedStatisticalReport(text, evidence, tierResults, startTime, finalWeightedScore);
    }
}

function createEnhancedStatisticalReport(text: string, evidence: Evidence[], tierResults: TierResult[], startTime: number, score: number, customReasoning?: string): FactCheckReport {
    const highCred = evidence.filter(e => e.credibilityScore >= 80).length;
    const reasoning = customReasoning || buildStatisticalReasoning(evidence, score, highCred);
    return {
        id: `fact_check_${Date.now()}`,
        originalText: text,
        finalVerdict: generateVerdictFromScore(score, evidence),
        finalScore: score,
        reasoning,
        evidence,
        metadata: {
            methodUsed: 'statistical-fallback', // ERROR WAS HERE
            processingTimeMs: Date.now() - startTime,
            apisUsed: tierResults.filter(t => t.success).map(t => t.tier),
            sourcesConsulted: { total: evidence.length, highCredibility: highCred },
            warnings: ['AI synthesis was unavailable or skipped; report is based on statistical analysis.'],
            tierBreakdown: tierResults
        }
    };
}

// --- HELPER FUNCTIONS ---
// This section contains all the necessary utility, mapping, scoring, and parsing functions.

function buildSynthesisPrompt(text: string, evidence: Evidence[], context: string): string {
    const evidenceSummary = evidence.slice(0, 15).map((e, i) => {
        const credRating = e.credibilityScore >= 80 ? 'HIGH' : e.credibilityScore >= 60 ? 'MED' : 'LOW';
        return `${i + 1}. [${credRating}-${e.credibilityScore}%] ${e.publisher}: "${(e.snippet || '').substring(0, 200)}..."`;
    }).join('\n');
    return `As a professional fact-checker for a ${context} publication, analyze the claim based ONLY on the evidence.

CLAIM: "${text}"

EVIDENCE:
${evidenceSummary}

Your Task: Provide a concise, professional analysis in this EXACT format. Do not add any extra text.

VERDICT: [TRUE, FALSE, MIXED, UNVERIFIED, MISLEADING]
SCORE: [0-100]
REASONING: [2-3 sentences explaining your verdict and score based on evidence quality and consistency.]
WARNINGS: [Note concerns like source quality or contradictions. If none, write "None"]`;
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timeoutId);
        return response;
    } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') throw new Error(`Request timeout after ${timeoutMs}ms`);
        throw error;
    }
}
async function callGeminiAPI(prompt: string, apiKey: string, model: string = 'gemini-1.5-flash-latest'): Promise<string> {
    try {
        const url = `${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`;
        const response = await fetchWithTimeout(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.2, maxOutputTokens: 1024 }
            })
        }, API_TIMEOUT * 2);
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Gemini API error: ${response.status} - ${errorBody}`);
        }
        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch (error: any) {
        logger.error('Gemini API call failed', { errorMessage: error.message });
        throw error;
    }
}
function mapSerpResultsToEvidence(results: any[] = [], knowledgeGraph?: any): Evidence[] {
    const evidence: Evidence[] = [];
    if (knowledgeGraph?.description) {
        evidence.push({
            id: `serp_kg_${Date.now()}`,
            quote: knowledgeGraph.description,
            title: knowledgeGraph.title || 'Knowledge Graph',
            snippet: knowledgeGraph.description,
            publisher: 'Google Knowledge Graph',
            url: knowledgeGraph.website || 'https://google.com',
            credibilityScore: 90, relevanceScore: 95,
            publicationDate: new Date().toISOString(),
            type: 'official_source',
            source: { name: 'Google Knowledge Graph', url: 'https://google.com', credibility: { rating: 'High', classification: 'Knowledge Graph', warnings: [] } }
        } as Evidence);
    }
    const mapped = results.map((result: any, index: number): Evidence | null => {
        if (!result.link) return null;
        const domain = extractDomain(result.link);
        const credScore = calculateSourceScore(domain);
        return {
            id: `serp_${Date.now()}_${index}`,
            quote: result.snippet || '', title: result.title, snippet: result.snippet || '',
            publisher: result.source || domain, url: result.link,
            credibilityScore: credScore,
            relevanceScore: calculateRelevanceScore(result.position),
            publicationDate: result.date || extractDateFromSnippet(result.snippet),
            type: 'search_result',
            source: {
                name: result.source || domain, url: result.link,
                credibility: { rating: credScore >= 80 ? 'High' : credScore >= 60 ? 'Medium' : 'Low', classification: classifySource(domain), warnings: getSourceWarnings(domain, credScore) }
            }
        } as Evidence;
    }).filter((e): e is Evidence => e !== null);
    return [...evidence, ...mapped];
}
function mapNewsResultsToEvidence(posts: any[] = []): Evidence[] {
    return posts.map((post: any, index: number): Evidence | null => {
        if (!post.url) return null;
        const domain = extractDomain(post.url);
        const publisher = post.thread?.site_full || post.author || domain;
        const credScore = calculateNewsSourceScore(domain, post);
        return {
            id: `news_${Date.now()}_${index}`,
            quote: post.text?.substring(0, 300) || '', title: post.title, snippet: post.text?.substring(0, 250) || '',
            publisher, url: post.url, credibilityScore: credScore, relevanceScore: 80,
            publicationDate: post.published, type: 'news',
            source: {
                name: publisher, url: post.url,
                credibility: { rating: credScore >= 80 ? 'High' : credScore >= 60 ? 'Medium' : 'Low', classification: 'News Publication', warnings: getSourceWarnings(domain, credScore) }
            }
        } as Evidence;
    }).filter((e): e is Evidence => e !== null);
}
function calculateTierConfidence(evidence: Evidence[]): number {
    if (evidence.length === 0) return 0;
    const avgCredibility = evidence.reduce((sum, e) => sum + e.credibilityScore, 0) / evidence.length;
    const highCredCount = evidence.filter(e => e.credibilityScore >= 85).length;
    const qualityBonus = Math.min(30, highCredCount * 10);
    return Math.min(100, (avgCredibility * 0.7) + qualityBonus);
}
function calculateOverallConfidence(evidence: Evidence[]): number {
    if (evidence.length === 0) return 0;
    const highCredSources = evidence.filter(e => e.credibilityScore >= 80);
    const otherSources = evidence.filter(e => e.credibilityScore < 80);
    if (highCredSources.length === 0) return calculateTierConfidence(otherSources);
    const highCredAvg = highCredSources.reduce((sum, e) => sum + e.credibilityScore, 0) / highCredSources.length;
    return Math.round(highCredAvg);
}
function calculateNewsSourceScore(domain: string, post: any): number {
    const baseScore = calculateSourceScore(domain);
    if (post.published) {
        const daysOld = (Date.now() - new Date(post.published).getTime()) / (1000 * 60 * 60 * 24);
        if (daysOld < 7) return Math.min(100, baseScore + 5);
    }
    return baseScore;
}
function calculateSourceScore(domain: string): number {
    const d = domain.toLowerCase();
    if (['reuters.com', 'apnews.com'].some(s => d.includes(s))) return 98;
    if (['bbc.com', 'bbc.co.uk'].some(s => d.includes(s))) return 95;
    if (['pbs.org', 'npr.org'].some(s => d.includes(s))) return 94;
    if (['factcheck.org', 'snopes.com', 'politifact.com'].some(s => d.includes(s))) return 92;
    if (['nytimes.com', 'washingtonpost.com', 'wsj.com'].some(s => d.includes(s))) return 88;
    if (d.includes('.gov')) return 90;
    if (d.includes('.edu')) return 85;
    if (d.includes('who.int') || d.includes('un.org')) return 93;
    return 60; // Default score
}
function parseGeminiResponse(text: string, evidence: Evidence[], weightedScore: number): { verdict: FactVerdict; score: number; reasoning: string; warnings: string[] } {
    const verdictMatch = text.match(/VERDICT:\s*(TRUE|FALSE|MIXED|UNVERIFIED|MISLEADING)/i);
    const scoreMatch = text.match(/SCORE:\s*(\d+)/i);
    const reasoningMatch = text.match(/REASONING:\s*(.+?)(?=WARNINGS:|$)/is);
    const warningsMatch = text.match(/WARNINGS:\s*(.+)/is);
    const aiScore = scoreMatch ? parseInt(scoreMatch[1], 10) : weightedScore;
    const verdict = verdictMatch ? (verdictMatch[1].toUpperCase() as FactVerdict) : generateVerdictFromScore(aiScore, evidence);
    const reasoning = reasoningMatch?.[1]?.trim() || "AI analysis could not be parsed.";
    const warnings: string[] = [];
    if (warningsMatch && warningsMatch[1].toLowerCase().trim() !== 'none') warnings.push(warningsMatch[1].trim());
    if (evidence.length < 3) warnings.push('Limited number of sources available.');
    return { verdict, score: aiScore, reasoning, warnings };
}
function mergeEvidence(existing: Evidence[], newEvidence: Evidence[]): Evidence[] {
    const evidenceMap = new Map<string, Evidence>();
    [...existing, ...newEvidence].forEach(e => { if (e.url) evidenceMap.set(e.url, e); });
    return Array.from(evidenceMap.values());
}
function refineQueryFromEvidence(originalText: string, evidence: Evidence[], targeted = false): string {
    const keyEntities = new Set(extractKeyEntities(originalText));
    evidence.forEach(e => { extractKeyEntities(e.title).forEach(entity => keyEntities.add(entity)); });
    const queryTerms = [...keyEntities].slice(0, 5);
    if (targeted) {
        const bestSnippet = evidence.sort((a, b) => b.credibilityScore - a.credibilityScore)[0]?.snippet;
        if (bestSnippet) {
            const phrase = bestSnippet.split(/[.!?]/)[0];
            if (phrase.length > 10) queryTerms.push(`"${phrase}"`);
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
    try { return new URL(url).hostname.replace('www.', ''); }
    catch { return url.split('/')[2]?.replace('www.', '') || url; }
}
function classifySource(domain: string): string {
    const d = domain.toLowerCase();
    if (d.includes('.gov')) return 'Government';
    if (d.includes('.edu')) return 'Academic';
    if (['reuters', 'apnews', 'bbc'].some(s => d.includes(s))) return 'News Agency';
    if (['factcheck', 'snopes', 'politifact'].some(s => d.includes(s))) return 'Fact-Checker';
    return 'Web Source';
}
function getSourceWarnings(domain: string, score: number): string[] {
    const warnings: string[] = [];
    if (score < 60) warnings.push('Low credibility source');
    if (domain.includes('blog')) warnings.push('Potential opinion content');
    return warnings;
}
function calculateRelevanceScore(position?: number): number {
    if (position && position <= 3) return 95;
    if (position && position <= 10) return 85;
    return 75;
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
    return 'UNVERIFIED';
}
