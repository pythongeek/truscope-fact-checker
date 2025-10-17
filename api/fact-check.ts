// api/fact-check.ts - FINAL VERSION: RESTORED 3-TIER SYSTEM & CORRECTED VERTEX AI USAGE
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Vercel timeout configuration
export const config = {
  maxDuration: 10, // Hobby tier limit is strict
};

// --- CONSTANTS ---
const GOOGLE_FACT_CHECK_URL = 'https://factchecktools.googleapis.com/v1alpha1/claims:search';
const SERPER_API_URL = 'https://google.serper.dev/search';
const WEBZ_API_URL = 'https://api.webz.io/newsApiLite';
const API_TIMEOUT = 3500; // Timeout for each external API call

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
  type: 'claim' | 'news' | 'search_result';
  source: { name: string; url: string; };
}

interface TierResult {
    tier: string;
    success: boolean;
    confidence: number;
    evidence: Evidence[];
    processingTime: number;
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
    methodUsed: string;
    processingTimeMs: number;
    apisUsed: string[];
    sourcesConsulted: { total: number; highCredibility: number; };
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

// --- MAIN HANDLER: 3-TIER SYSTEM ---
export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const startTime = Date.now();
    const { text, publishingContext = 'journalism', config = {} } = req.body;

    if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'Text is required.' });
    }

    logger.info('🚀 Starting 3-Tier Fact-Check Process', { textLength: text.length });

    try {
        const query = extractSmartQuery(text, 120);

        // Run all three tiers in parallel to gather maximum evidence
        const results = await Promise.allSettled([
            runTier1_GoogleFactCheck(query),
            runTier2_WebSearch(query),
            runTier3_NewsSearch(query)
        ]);
        
        const tierResults: TierResult[] = results.map(result => {
            if (result.status === 'fulfilled') return result.value;
            // Create a failure result if a promise was rejected
            logger.error('A tier promise was rejected', { reason: result.reason });
            return { tier: 'unknown-error', success: false, confidence: 0, evidence: [], summary: 'Tier failed unexpectedly.', processingTime: 0 };
        });

        const allEvidence = mergeEvidence(
            tierResults[0]?.evidence || [],
            tierResults[1]?.evidence || [],
            tierResults[2]?.evidence || []
        );
        
        logger.info(`Evidence gathering complete. Total unique sources: ${allEvidence.length}`);

        // Final Phase: AI-Powered Synthesis using the project's Vertex AI endpoint
        const finalReport = await runSynthesis(text, allEvidence, publishingContext, tierResults, startTime, req);

        logger.info('✅ Fact-Check Complete', {
            finalScore: finalReport.finalScore,
            verdict: finalReport.finalVerdict,
        });

        return res.status(200).json(finalReport);

    } catch (error: any) {
        logger.error('Fact-check handler failed', { errorMessage: error.message });
        return res.status(500).json({ error: 'An internal server error occurred.' });
    }
}

// --- TIER 1: GOOGLE FACT CHECK ---
async function runTier1_GoogleFactCheck(query: string): Promise<TierResult> {
    const startTime = Date.now();
    const apiKey = process.env.GOOGLE_FACT_CHECK_API_KEY;
    if (!apiKey) {
        logger.warn('Phase 1 Skipped: GOOGLE_FACT_CHECK_API_KEY not configured.');
        return { tier: 'direct-verification', success: false, confidence: 0, evidence: [], summary: "API key not configured.", processingTime: Date.now() - startTime };
    }

    try {
        const url = `${GOOGLE_FACT_CHECK_URL}?query=${encodeURIComponent(query)}&key=${apiKey}`;
        const response = await fetch(url, { signal: AbortSignal.timeout(API_TIMEOUT) });
        if (!response.ok) throw new Error(`API returned status ${response.status}`);
        const data = await response.json();
        const evidence = mapGoogleFactCheckToEvidence(data.claims || []);
        const confidence = calculateTierConfidence(evidence);
        logger.info(`Phase 1 (Google Fact Check) Complete: Found ${evidence.length} claims.`);
        return { tier: 'direct-verification', success: evidence.length > 0, confidence, evidence, summary: `Found ${evidence.length} published fact-checks.`, processingTime: Date.now() - startTime };
    } catch (error: any) {
        logger.error('Phase 1 (Google Fact Check) Failed', { error: error.message });
        return { tier: 'direct-verification', success: false, confidence: 0, evidence: [], summary: error.message, processingTime: Date.now() - startTime };
    }
}

// --- TIER 2: WEB SEARCH (SERPER) ---
async function runTier2_WebSearch(query: string): Promise<TierResult> {
    const startTime = Date.now();
    const apiKey = process.env.SERP_API_KEY;
    if (!apiKey) {
        logger.warn('Phase 2 Skipped: SERP_API_KEY not configured.');
        return { tier: 'web-search', success: false, confidence: 0, evidence: [], summary: "API key not configured.", processingTime: Date.now() - startTime };
    }
    try {
        const response = await fetch(SERPER_API_URL, {
            method: 'POST',
            headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ q: query, num: 10 }),
            signal: AbortSignal.timeout(API_TIMEOUT)
        });
        if (!response.ok) throw new Error(`API returned status ${response.status}`);
        const data = await response.json();
        const evidence = mapSerpResultsToEvidence(data.organic || []);
        const confidence = calculateTierConfidence(evidence);
        logger.info(`Phase 2 (Web Search) Complete: Found ${evidence.length} results.`);
        return { tier: 'web-search', success: evidence.length > 0, confidence, evidence, summary: `Found ${evidence.length} web results.`, processingTime: Date.now() - startTime };
    } catch (error: any) {
        logger.error('Phase 2 (Web Search) Failed', { error: error.message });
        return { tier: 'web-search', success: false, confidence: 0, evidence: [], summary: error.message, processingTime: Date.now() - startTime };
    }
}

// --- TIER 3: NEWS SEARCH (WEBZ) ---
async function runTier3_NewsSearch(query: string): Promise<TierResult> {
    const startTime = Date.now();
    const apiKey = process.env.WEBZ_API_KEY;
    if (!apiKey) {
        logger.warn('Phase 3 Skipped: WEBZ_API_KEY not configured.');
        return { tier: 'news-analysis', success: false, confidence: 0, evidence: [], summary: "API key not configured.", processingTime: Date.now() - startTime };
    }
    try {
        // **FIX**: Removed restrictive quotes from query to get broader results
        const params = new URLSearchParams({ token: apiKey, q: query, size: '10' });
        const response = await fetch(`${WEBZ_API_URL}?${params.toString()}`, { signal: AbortSignal.timeout(API_TIMEOUT) });
        if (!response.ok) throw new Error(`API returned status ${response.status}`);
        const data = await response.json();
        const evidence = mapNewsResultsToEvidence(data.posts || []);
        const confidence = calculateTierConfidence(evidence);
        logger.info(`Phase 3 (News Search) Complete: Found ${evidence.length} articles.`);
        return { tier: 'news-analysis', success: evidence.length > 0, confidence, evidence, summary: `Found ${evidence.length} news articles.`, processingTime: Date.now() - startTime };
    } catch (error: any) {
        logger.error('Phase 3 (News Search) Failed', { error: error.message });
        return { tier: 'news-analysis', success: false, confidence: 0, evidence: [], summary: error.message, processingTime: Date.now() - startTime };
    }
}

// --- AI SYNTHESIS & REPORTING ---
async function runSynthesis(text: string, evidence: Evidence[], context: string, tierResults: TierResult[], startTime: number, originalReq: VercelRequest): Promise<FactCheckReport> {
    const evidenceScore = calculateOverallConfidence(evidence);

    if (evidence.length < 3) {
        logger.warn(`Synthesis skipped: Insufficient evidence found (${evidence.length}).`);
        return createStatisticalReport(text, evidence, tierResults, startTime, evidenceScore);
    }

    try {
        const prompt = buildSynthesisPrompt(text, evidence, context);
        
        // **FIX**: Correctly call the internal /api/vertex endpoint
        const vertexResponse = await callVertexAPI(prompt, originalReq);
        
        const synthesis = parseGeminiResponse(vertexResponse, evidence, evidenceScore);
        const finalScore = Math.round((synthesis.score * 0.5) + (evidenceScore * 0.5));

        return {
            id: `fact_check_${Date.now()}`,
            originalText: text,
            finalVerdict: synthesis.verdict,
            finalScore,
            reasoning: synthesis.reasoning,
            evidence,
            metadata: {
                methodUsed: '3-tier-vertex-synthesis',
                processingTimeMs: Date.now() - startTime,
                apisUsed: tierResults.filter(t => t.success).map(t => t.tier),
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
        return createStatisticalReport(text, evidence, tierResults, startTime, evidenceScore);
    }
}

// --- HELPER FUNCTIONS ---

async function callVertexAPI(prompt: string, originalReq: VercelRequest): Promise<string> {
    // Construct the full URL for the internal API call
    const host = originalReq.headers['host'];
    const protocol = host?.includes('localhost') ? 'http' : 'https';
    const internalApiUrl = `${protocol}://${host}/api/vertex`;

    logger.info('Calling internal Vertex AI endpoint', { url: internalApiUrl });

    const response = await fetch(internalApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt }),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Internal Vertex API call failed: ${response.status} - ${errorBody}`);
    }
    const data = await response.json();
    return data.text || '';
}

function createStatisticalReport(text: string, evidence: Evidence[], tierResults: TierResult[], startTime: number, score: number): FactCheckReport {
    return {
        id: `fact_check_${Date.now()}`,
        originalText: text,
        finalVerdict: generateVerdictFromScore(score, evidence),
        finalScore: score,
        reasoning: `AI synthesis was skipped. Based on a statistical analysis of ${evidence.length} sources, the claim has a reliability score of ${score}%.`,
        evidence,
        metadata: {
            methodUsed: 'statistical-fallback',
            processingTimeMs: Date.now() - startTime,
            apisUsed: tierResults.filter(t => t.success).map(t => t.tier),
            sourcesConsulted: { total: evidence.length, highCredibility: evidence.filter(e => e.credibilityScore >= 80).length },
            warnings: ['AI synthesis was unavailable or skipped due to insufficient evidence.'],
            tierBreakdown: tierResults
        }
    };
}

function mapGoogleFactCheckToEvidence(claims: any[]): Evidence[] {
    return claims.map((claim: any, index: number): Evidence | null => {
        const review = claim.claimReview?.[0];
        if (!review?.url) return null;
        const domain = extractDomain(review.url);
        const credScore = calculateSourceScore(domain);
        return {
            id: `gfc_${Date.now()}_${index}`,
            url: review.url,
            title: review.title || claim.text,
            snippet: review.textualRating,
            publisher: review.publisher?.name || domain,
            publicationDate: claim.claimDate,
            credibilityScore: credScore,
            relevanceScore: 90,
            type: 'claim',
            source: { name: review.publisher?.name || domain, url: review.publisher?.site || `https://${domain}` }
        };
    }).filter((e): e is Evidence => e !== null);
}

function mapSerpResultsToEvidence(results: any[]): Evidence[] {
    return results.map((result: any, index: number): Evidence | null => {
        if (!result.link) return null;
        const domain = extractDomain(result.link);
        const credScore = calculateSourceScore(domain);
        return {
            id: `serp_${Date.now()}_${index}`,
            url: result.link, title: result.title, snippet: result.snippet || '',
            publisher: result.source || domain,
            credibilityScore: credScore,
            relevanceScore: 80,
            publicationDate: result.date,
            type: 'search_result',
            source: { name: result.source || domain, url: result.link }
        };
    }).filter((e): e is Evidence => e !== null);
}

function mapNewsResultsToEvidence(posts: any[]): Evidence[] {
    return posts.map((post: any, index: number): Evidence | null => {
        if (!post.url) return null;
        const domain = extractDomain(post.url);
        const credScore = calculateSourceScore(domain);
        return {
            id: `news_${Date.now()}_${index}`,
            url: post.url, title: post.title, snippet: post.text?.substring(0, 250) || '',
            publisher: post.thread?.site_full || domain,
            credibilityScore: credScore, relevanceScore: 85,
            publicationDate: post.published, type: 'news',
            source: { name: post.thread?.site_full || domain, url: post.url }
        };
    }).filter((e): e is Evidence => e !== null);
}

function buildSynthesisPrompt(text: string, evidence: Evidence[], context: string): string {
    const evidenceSummary = evidence.slice(0, 15).map(e => `[${e.credibilityScore}% credibility] ${e.publisher}: "${(e.snippet || '').substring(0, 200)}..."`).join('\n');
    return `As a professional fact-checker for a ${context} publication, analyze the claim based ONLY on the evidence provided.

CLAIM: "${text}"

EVIDENCE:
${evidenceSummary}

Your Task: Provide a concise, professional analysis in this EXACT format. Do not add any extra text.

VERDICT: [TRUE, FALSE, MIXED, UNVERIFIED, MISLEADING]
SCORE: [0-100]
REASONING: [2-3 sentences explaining your verdict and score based on evidence quality and consistency.]
WARNINGS: [Note concerns like source quality or contradictions. If none, write "None"]`;
}

function parseGeminiResponse(text: string, evidence: Evidence[], evidenceScore: number): { verdict: FactVerdict; score: number; reasoning: string; warnings: string[] } {
    const verdictMatch = text.match(/VERDICT:\s*(TRUE|FALSE|MIXED|UNVERIFIED|MISLEADING)/i);
    const scoreMatch = text.match(/SCORE:\s*(\d+)/i);
    const reasoningMatch = text.match(/REASONING:\s*(.+?)(?=WARNINGS:|$)/is);
    const warningsMatch = text.match(/WARNINGS:\s*(.+)/is);
    const aiScore = scoreMatch ? parseInt(scoreMatch[1], 10) : evidenceScore;
    const verdict = verdictMatch ? (verdictMatch[1].toUpperCase() as FactVerdict) : generateVerdictFromScore(aiScore, evidence);
    const reasoning = reasoningMatch?.[1]?.trim() || "AI analysis could not be parsed.";
    const warnings = warningsMatch && warningsMatch[1].toLowerCase().trim() !== 'none' ? [warningsMatch[1].trim()] : [];
    return { verdict, score: aiScore, reasoning, warnings };
}

function mergeEvidence(...evidenceArrays: Evidence[][]): Evidence[] {
    const evidenceMap = new Map<string, Evidence>();
    for (const arr of evidenceArrays) {
        for (const e of arr) {
            if (e.url) evidenceMap.set(e.url, e);
        }
    }
    return Array.from(evidenceMap.values());
}

function calculateTierConfidence(evidence: Evidence[]): number {
    if (evidence.length === 0) return 0;
    const avgCredibility = evidence.reduce((sum, e) => sum + e.credibilityScore, 0) / evidence.length;
    const highCredCount = evidence.filter(e => e.credibilityScore >= 85).length;
    const qualityBonus = Math.min(25, highCredCount * 8);
    return Math.min(100, Math.round((avgCredibility * 0.75) + qualityBonus));
}

function calculateOverallConfidence(evidence: Evidence[]): number {
    if (evidence.length === 0) return 0;
    const highCredSources = evidence.filter(e => e.credibilityScore >= 80);
    if (highCredSources.length > 0) {
        return Math.round(highCredSources.reduce((sum, e) => sum + e.credibilityScore, 0) / highCredSources.length);
    }
    return calculateTierConfidence(evidence);
}

function calculateSourceScore(domain: string): number {
    const d = domain.toLowerCase();
    if (['reuters.com', 'apnews.com', 'ap.org'].some(s => d.includes(s))) return 98;
    if (['bbc.com', 'bbc.co.uk', 'factcheck.org', 'snopes.com', 'politifact.com'].some(s => d.includes(s))) return 95;
    if (['nytimes.com', 'washingtonpost.com', 'wsj.com'].some(s => d.includes(s))) return 90;
    if (d.includes('.gov') || d.includes('who.int') || d.includes('un.org')) return 88;
    if (d.includes('.edu')) return 85;
    return 65;
}

function generateVerdictFromScore(score: number, evidence: Evidence[]): FactVerdict {
    const highQualitySources = evidence.filter(e => e.credibilityScore >= 85).length;
    if (score >= 90 && highQualitySources >= 2) return 'TRUE';
    if (score >= 70) return 'MIXED';
    if (score >= 50) return 'MISLEADING';
    if (score < 50 && evidence.length > 0) return 'FALSE';
    return 'UNVERIFIED';
}

function extractSmartQuery(text: string, maxLength: number): string {
    const cleaned = text.replace(/[^\w\s.,'"]/g, '').replace(/\s+/g, ' ').trim();
    const firstSentence = cleaned.match(/^[^.!?]+[.!?]/)?.[0] || cleaned;
    const trimmed = firstSentence.trim();
    if (trimmed.length <= maxLength) return trimmed;
    const truncated = trimmed.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    return lastSpace > 0 ? truncated.substring(0, lastSpace) : truncated;
}

function extractDomain(url: string): string {
    try { return new URL(url).hostname.replace('www.', ''); } catch { return ''; }
}
