import { GoogleGenAI, Type } from "@google/genai";
import { FactCheckReport, ClaimNormalization, PreliminaryAnalysis } from '@/types/factCheck';
import { getGeminiApiKey, getNewsDataApiKey, getGeminiModel } from './apiKeyService';
import { NewsArticle, GoogleSearchResult } from "../types";
import { factCheckCache } from './caching';
import { search } from './webSearch';
import { enhancedFactCheck } from './textAnalysisService';
import { RealTimeFactDBService } from './realTimeFactDB';
import { FactDatabase, FactVerdict } from "../types/factDatabase";
import { parseAIJsonResponse } from '../utils/jsonParser';
import { generateSHA256 } from '../utils/hashUtils';

// Helper function to extract text from different SDK response structures
const extractTextFromGeminiResponse = (result: any): string => {
    console.log('Gemini API raw response structure:', Object.keys(result || {}));

    if (!result) {
        throw new Error('No response from AI model');
    }

    let responseText: string = '';

    try {
        // Method 1: New @google/genai SDK - text() method
        if (typeof result.text === 'function') {
            responseText = result.text();
            console.log('Used result.text() method');
        }
        // Method 2: New SDK - response.text() property
        else if (result.response && typeof result.response.text === 'function') {
            responseText = result.response.text();
            console.log('Used result.response.text() method');
        }
        // Method 3: Old SDK - direct text property
        else if (typeof result.text === 'string') {
            responseText = result.text;
            console.log('Used result.text property');
        }
        // Method 4: Old SDK - response.text property
        else if (result.response && typeof result.response.text === 'string') {
            responseText = result.response.text;
            console.log('Used result.response.text property');
        }
        // Method 5: Candidates structure (common in Google AI APIs)
        else if (result.candidates && Array.isArray(result.candidates) && result.candidates.length > 0) {
            const candidate = result.candidates[0];
            if (candidate.content && candidate.content.parts && Array.isArray(candidate.content.parts)) {
                responseText = candidate.content.parts.map((part: any) => part.text || '').join('');
                console.log('Used candidates structure');
            }
        }
        // Method 5b: A new candidate structure seen in recent logs
        else if (result.candidates && Array.isArray(result.candidates) && result.candidates.length > 0) {
            const candidate = result.candidates[0];
            if (candidate.content && typeof candidate.content === 'object' && candidate.content.parts && Array.isArray(candidate.content.parts) && candidate.content.parts.length > 0) {
                 responseText = candidate.content.parts[0].text;
                 console.log('Used new candidate structure');
            }
        }
        // Method 6: Direct content extraction
        else if (result.content) {
            if (typeof result.content === 'string') {
                responseText = result.content;
            } else if (result.content.parts && Array.isArray(result.content.parts)) {
                responseText = result.content.parts.map((part: any) => part.text || '').join('');
            }
            console.log('Used content structure');
        }
        // Method 7: Last resort - stringify and try to extract JSON
        else {
            const stringified = JSON.stringify(result);
            console.log('Response structure not recognized, raw response:', stringified.substring(0, 500));

            // Try to find JSON in the stringified response
            const jsonMatch = stringified.match(/\{.*\}/);
            if (jsonMatch) {
                responseText = jsonMatch[0];
                console.log('Extracted JSON from stringified response');
            } else {
                responseText = stringified;
            }
        }
    } catch (error) {
        console.error('Error extracting text from response:', error);
        responseText = JSON.stringify(result);
    }

    if (!responseText || responseText.trim() === '') {
        console.error('Empty response after all extraction attempts');
        throw new Error('Empty response from AI model after trying all extraction methods');
    }

    console.log('Extracted response text (first 200 chars):', responseText.substring(0, 200));
    return responseText.trim();
};

// AI Client Setup
const getAiClient = () => {
    const apiKey = getGeminiApiKey();
    return new GoogleGenAI({ apiKey });
}

// Type definition for prompts that can't use responseSchema
const FACT_CHECK_REPORT_TYPE_DEFINITION = `
interface FactCheckReport {
    final_verdict: string;
    final_score: number; // 0-100
    score_breakdown: {
        final_score_formula: string;
        metrics: {
            name: 'Source Reliability' | 'Corroboration' | 'Directness' | 'Freshness' | 'Contradiction';
            score: number; // 0-100
            description: string;
        }[];
        confidence_intervals?: { lower_bound: number; upper_bound: number; };
    };
    evidence: {
        id: string;
        publisher: string;
        url: string | null;
        quote: string;
        score: number; // 0-100 reliability score
        type: 'claim' | 'news' | 'search_result';
    }[];
    metadata: {
        method_used: string;
        processing_time_ms: number; // Set to 0, will be replaced.
        apis_used: string[];
        sources_consulted: { total: number; high_credibility: number; conflicting: number; };
        warnings: string[];
    };
    searchEvidence?: {
        query: string;
        results: { title: string; link: string; snippet: string; source: string; }[];
    };
    originalTextSegments?: {
        text: string;
        score: number;
        color: 'green' | 'yellow' | 'red' | 'default';
    }[];
    reasoning?: string;
}
`;

// Schema for calls that don't use search tools
const factCheckReportSchema = {
    type: Type.OBJECT,
    properties: {
        final_verdict: { type: Type.STRING, description: "The final, conclusive verdict on the claim's credibility." },
        final_score: { type: Type.INTEGER, description: "A numerical score from 0 to 100 representing the credibility." },
        score_breakdown: {
            type: Type.OBJECT,
            properties: {
                final_score_formula: { type: Type.STRING, description: "The formula or reasoning used to calculate the final score." },
                metrics: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING, description: "Name of the metric (e.g., 'Source Reliability')." },
                            score: { type: Type.INTEGER, description: "Score for this metric (0-100)." },
                            description: { type: Type.STRING, description: "Brief description of the metric." },
                        },
                        required: ['name', 'score', 'description']
                    }
                },
                confidence_intervals: {
                    type: Type.OBJECT,
                    nullable: true,
                    properties: {
                        lower_bound: { type: Type.INTEGER },
                        upper_bound: { type: Type.INTEGER }
                    },
                    required: ['lower_bound', 'upper_bound']
                }
            },
            required: ['final_score_formula', 'metrics']
        },
        evidence: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.STRING, description: "A unique identifier for the evidence item." },
                    publisher: { type: Type.STRING, description: "The publisher or source of the evidence." },
                    url: { type: Type.STRING, description: "The URL to the source, if available.", nullable: true },
                    quote: { type: Type.STRING, description: "The specific quote or piece of evidence." },
                    score: { type: Type.INTEGER, description: "A reliability score for this piece of evidence (0-100)." },
                    type: { type: Type.STRING, description: "The type of evidence (e.g., 'claim', 'news')." }
                },
                required: ['id', 'publisher', 'quote', 'score', 'type']
            }
        },
        metadata: {
            type: Type.OBJECT,
            properties: {
                method_used: { type: Type.STRING, description: "The name of the analysis method used." },
                processing_time_ms: { type: Type.INTEGER, description: "Placeholder for processing time (set to 0)." },
                apis_used: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of APIs or tools used." },
                sources_consulted: {
                    type: Type.OBJECT,
                    properties: {
                        total: { type: Type.INTEGER },
                        high_credibility: { type: Type.INTEGER },
                        conflicting: { type: Type.INTEGER }
                    },
                    required: ['total', 'high_credibility', 'conflicting']
                },
                warnings: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Any warnings or limitations of the analysis." }
            },
            required: ['method_used', 'processing_time_ms', 'apis_used', 'sources_consulted', 'warnings']
        },
        searchEvidence: {
            type: Type.OBJECT,
            nullable: true,
            properties: {
                query: { type: Type.STRING, description: "The search query used to find evidence." },
                results: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING },
                            link: { type: Type.STRING },
                            snippet: { type: Type.STRING },
                            source: { type: Type.STRING }
                        },
                        required: ['title', 'link', 'snippet', 'source']
                    }
                }
            },
            required: ['query', 'results']
        },
        originalTextSegments: {
            type: Type.ARRAY,
            nullable: true,
            items: {
                type: Type.OBJECT,
                properties: {
                    text: { type: Type.STRING },
                    score: { type: Type.INTEGER },
                    color: {
                        type: Type.STRING,
                        enum: ['green', 'yellow', 'red', 'default']
                    }
                },
                required: ['text', 'score', 'color']
            }
        },
        reasoning: { type: Type.STRING, nullable: true, description: "AI's explanation for the verdict." }
    },
    required: ['final_verdict', 'final_score', 'score_breakdown', 'evidence', 'metadata']
};

const preliminaryAnalysisSchema = {
    type: Type.OBJECT,
    properties: {
        preliminaryVerdict: { type: Type.STRING, description: "The preliminary verdict on the claim." },
        preliminaryScore: { type: Type.INTEGER, description: "A preliminary score (0-100)." },
        claims: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    claim: { type: Type.STRING, description: "The extracted sub-claim to verify." },
                    justification: { type: Type.STRING, description: "Justification for why this claim needs checking." },
                    searchQuery: { type: Type.STRING, description: "A targeted search query for this claim." },
                },
                required: ['claim', 'justification', 'searchQuery']
            }
        },
        textSegments: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    text: { type: Type.STRING, description: "A segment of the original text." },
                    score: { type: Type.INTEGER, description: "A preliminary score for this segment (0-100)." },
                },
                required: ['text', 'score']
            }
        }
    },
    required: ['preliminaryVerdict', 'preliminaryScore', 'claims', 'textSegments']
};

// --- Orchestration Steps ---

// 1. Normalize Claim
// Updated normalizeClaim function with comprehensive error handling
const normalizeClaim = async (claimText: string): Promise<ClaimNormalization> => {
    if (!claimText || claimText.trim() === '') {
        throw new Error('Empty claim text provided');
    }

    try {
        console.log('Starting claim normalization for:', claimText.substring(0, 100));

        const ai = getAiClient();

        // Simple prompt without complex schemas first
        const simplePrompt = `Extract key information from this text and respond with valid JSON:

Text: "${claimText}"

Respond with exactly this JSON structure:
{
  "original_claim": "${claimText}",
  "normalized_claim": "simplified version of the main claim",
  "keywords": ["keyword1", "keyword2", "keyword3"]
}`;

        const result = await ai.models.generateContent({
            model: getGeminiModel(),
            contents: simplePrompt,
            config: {
                temperature: 0.1,
                maxOutputTokens: 1000,
            }
        });

        const responseText = extractTextFromGeminiResponse(result);
        console.log('Normalization AI response:', responseText);

        const parsedResult = parseAIJsonResponse(responseText);

        // Validate the response has required fields
        if (parsedResult && parsedResult.normalized_claim && parsedResult.keywords && Array.isArray(parsedResult.keywords)) {
            console.log('Successfully normalized claim');
            return parsedResult as ClaimNormalization;
        } else {
            console.warn('AI response missing required fields, using fallback');
            throw new Error('AI response validation failed');
        }

    } catch (error) {
        console.error("Error normalizing claim:", error);
        console.error("Claim text:", claimText);

        // Robust fallback normalization
        const words = claimText.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2);

        const keywords = [...new Set(words)]
            .filter(word => !['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'].includes(word))
            .slice(0, 5);

        const fallbackNormalization: ClaimNormalization = {
            original_claim: claimText.trim(),
            normalized_claim: claimText.trim(),
            keywords: keywords.length > 0 ? keywords : [claimText.split(' ')[0] || 'unknown']
        };

        console.log("Using fallback normalization:", fallbackNormalization);
        return fallbackNormalization;
    }
};

// --- Verification Methods ---

const runGeminiOnlyCheckWithFallback = async (normalizedClaim: ClaimNormalization, context?: string): Promise<FactCheckReport> => {
    try {
        const ai = getAiClient();
        
        // Simplified prompt for better reliability
        const prompt = `You are a fact-checking AI. Analyze this claim and provide a JSON response:

Claim: "${normalizedClaim.normalized_claim}"
Keywords: ${normalizedClaim.keywords.join(', ')}

Provide a JSON response with:
- final_verdict: string (like "True", "False", "Mixed", "Unverified")
- final_score: number from 0-100
- reasoning: string explaining your assessment
- evidence: array of evidence objects

Make sure your response is valid JSON.`;

        const result = await ai.models.generateContent({
            model: getGeminiModel(),
            contents: prompt,
            config: {
                temperature: 0.2,
                maxOutputTokens: 2000,
            }
        });

        const responseText = extractTextFromGeminiResponse(result);
        const parsed = parseAIJsonResponse(responseText);

        // Create a proper FactCheckReport structure
        const report: FactCheckReport = {
            id: `gemini-only-${Math.random().toString(36).substr(2, 9)}`,
            originalText: normalizedClaim.original_claim,
            final_verdict: parsed.final_verdict || 'Unverified',
            final_score: parsed.final_score || 50,
            reasoning: parsed.reasoning || 'Analysis completed with limited information',
            score_breakdown: {
                final_score_formula: "AI assessment based on internal knowledge",
                metrics: [
                    {
                        name: 'Internal Knowledge',
                        score: parsed.final_score || 50,
                        description: 'Assessment based on AI training data'
                    }
                ],
                confidence_intervals: {
                    lower_bound: Math.max(0, (parsed.final_score || 50) - 15),
                    upper_bound: Math.min(100, (parsed.final_score || 50) + 15)
                }
            },
            evidence: parsed.evidence || [],
            metadata: {
                method_used: 'gemini-only',
                processing_time_ms: 0,
                apis_used: ['gemini'],
                sources_consulted: {
                    total: 0,
                    high_credibility: 0,
                    conflicting: 0
                },
                warnings: []
            },
            enhanced_claim_text: normalizedClaim.normalized_claim,
            originalTextSegments: [{
                text: normalizedClaim.normalized_claim,
                score: parsed.final_score || 50,
                color: (parsed.final_score || 50) >= 75 ? 'green' : (parsed.final_score || 50) >= 40 ? 'yellow' : 'red'
            }]
        };

        return report;

    } catch (error) {
        console.error("Error in Gemini-only check:", error);

        // Return a basic fallback report
        return {
            id: `gemini-error-${Math.random().toString(36).substr(2, 9)}`,
            originalText: normalizedClaim.original_claim,
            final_verdict: 'Analysis Error',
            final_score: 0,
            reasoning: `Unable to complete analysis: ${error.message}`,
            score_breakdown: {
                final_score_formula: "error occurred",
                metrics: [
                    {
                        name: 'Error Status',
                        score: 0,
                        description: 'Analysis failed due to technical error'
                    }
                ]
            },
            evidence: [],
            metadata: {
                method_used: 'gemini-only',
                processing_time_ms: 0,
                apis_used: ['gemini'],
                sources_consulted: {
                    total: 0,
                    high_credibility: 0,
                    conflicting: 0
                },
                warnings: [`Analysis failed: ${error.message}`]
            },
            enhanced_claim_text: normalizedClaim.normalized_claim,
            originalTextSegments: [{
                text: normalizedClaim.normalized_claim,
                score: 0,
                color: 'red'
            }]
        };
    }
};

const runGoogleSearchAndAiCheck = async (normalizedClaim: ClaimNormalization, context?: string): Promise<FactCheckReport> => {
    const ai = getAiClient();
    const prompt = `
        You are TruScope AI, an advanced fact-checking engine.
        Your task is to verify the following claim *exclusively* using Google Search.
        Synthesize the search results to determine a verdict. Identify high-quality sources and extract key evidence.
        Do not use your internal knowledge; your analysis must be based solely on the provided search results.
        
        Claim: "${normalizedClaim.normalized_claim}"
        Keywords for search: ${normalizedClaim.keywords.join(', ')}
        ${context ? `Context: "${context}"` : ''}

        Construct a detailed FactCheckReport. Respond ONLY with a valid JSON object as a string that conforms to this TypeScript interface:
        ${FACT_CHECK_REPORT_TYPE_DEFINITION}
    `;
    const result = await ai.models.generateContent({
        model: getGeminiModel(),
        contents: prompt,
        config: {
            tools: [{ googleSearch: {} }],
        },
    });
    const jsonString = result.text.trim();
    return parseAIJsonResponse(jsonString) as FactCheckReport;
};

const runHybridCheck = async (normalizedClaim: ClaimNormalization, context?: string): Promise<FactCheckReport> => {
    const ai = getAiClient();
    const prompt = `
        You are TruScope AI, an advanced fact-checking engine.
        Perform a comprehensive, hybrid analysis of the following claim.
        1. First, use your internal knowledge base to form a preliminary assessment.
        2. Then, use Google Search to find real-time, external evidence to corroborate, contradict, or contextualize your findings.
        3. Synthesize both internal knowledge and external search results to provide a final, nuanced verdict.
        
        Claim: "${normalizedClaim.normalized_claim}"
        Keywords for search: ${normalizedClaim.keywords.join(', ')}
        ${context ? `Context: "${context}"` : ''}

        Construct a detailed FactCheckReport that reflects this hybrid methodology. Respond ONLY with a valid JSON object as a string that conforms to this TypeScript interface:
        ${FACT_CHECK_REPORT_TYPE_DEFINITION}
    `;
    const result = await ai.models.generateContent({
        model: getGeminiModel(),
        contents: prompt,
        config: {
            tools: [{ googleSearch: {} }],
        },
    });
    const jsonString = result.text.trim();
    return parseAIJsonResponse(jsonString) as FactCheckReport;
};

// NEW: Citation-Augmented Core Analysis Method
const runCitationAugmentedCheck = async (normalizedClaim: ClaimNormalization, context?: string): Promise<FactCheckReport> => {
    const ai = getAiClient();

    // --- 1. Preliminary Analysis ---
    const preliminaryAnalysisPrompt = `
        You are a fact-checking AI assistant. Analyze the following text and provide a preliminary analysis.
        Text: "${normalizedClaim.normalized_claim}"
        ${context ? `Context: "${context}"` : ''}

        Your task is to:
        1. Break down the text into verifiable claims.
        2. For each claim, provide a brief justification for why it needs checking.
        3. For each claim, generate a targeted Google search query to find verifying or disproving evidence. The query should be specific, focusing on credible sources like fact-checking sites, government domains, or established news outlets.
        4. Break down the original text into segments and assign a preliminary score (0-100) indicating your initial confidence in each segment's factuality based on your internal knowledge.
        5. Provide a preliminary overall verdict and score for the entire text.

        Focus on generating high-quality, targeted search queries that will find authoritative sources. Use tactics like:
        - site:factcheck.org OR site:politifact.com OR site:snopes.com for fact-checking sites
        - site:gov for government sources
        - site:reuters.com OR site:apnews.com for news verification
        - Including specific terms like "fact check", "verified", "debunked" when appropriate

        Respond ONLY with a JSON object in the following format.
    `;

    const result = await ai.models.generateContent({
        model: getGeminiModel(),
        contents: preliminaryAnalysisPrompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: preliminaryAnalysisSchema,
        },
    });
    const jsonString = result.text.trim();
    const preliminaryAnalysis: PreliminaryAnalysis = parseAIJsonResponse(jsonString);

    // --- 2. External Evidence Gathering ---
    console.log("Starting targeted searches for verification...");
    const searchPromises = preliminaryAnalysis.claims.map(claim => search(claim.searchQuery, 5));
    const searchResultsByClaim = await Promise.all(searchPromises);
    const allSearchResults = searchResultsByClaim.flat();

    // Deduplicate results based on the link to avoid redundancy
    const uniqueResults = new Map<string, GoogleSearchResult>();
    for (const result of allSearchResults) {
        if (result && result.link && !uniqueResults.has(result.link)) {
            uniqueResults.set(result.link, result);
        }
    }
    const searchResults = Array.from(uniqueResults.values());

    console.log(`Found ${searchResults.length} unique external sources for verification.`);

    // --- 3. Final Analysis ---
    const finalAnalysisPrompt = `
        You are TruScope AI, an advanced fact-checking engine.
        You have performed a preliminary analysis on a claim and have gathered external evidence from web searches.
        Your task is to synthesize your internal knowledge (from the preliminary analysis) with the external evidence to produce a final, comprehensive FactCheckReport.

        **Original Claim:** "${normalizedClaim.normalized_claim}"

        **Preliminary Analysis:**
        ${JSON.stringify(preliminaryAnalysis, null, 2)}

        **External Evidence (Search Results):**
        ${JSON.stringify(searchResults, null, 2)}

        Based on all this information, construct a final FactCheckReport. The report must be thorough and objective.

        **CRITICAL REQUIREMENTS:**
        1. **reasoning**: Provide a detailed explanation of how the external evidence confirmed, contradicted, or clarified your initial assessment. Be specific about which sources supported or contradicted the claim.

        2. **originalTextSegments**: Transform the textSegments from the preliminary analysis into color-coded segments:
           - Use the same text segments from preliminary analysis
           - Update scores based on the external evidence found
           - Assign colors based on final scores: 75-100 = 'green', 40-74 = 'yellow', 0-39 = 'red'

        3. **evidence**: ONLY include evidence from the external search results. Do not include "Internal Knowledge Base" entries. Each evidence item should reference a specific search result with a real URL.

        4. **metadata.warnings**: If search results were limited or contradictory, add appropriate warnings.

        Respond ONLY with a valid JSON object that conforms to the FactCheckReport schema.
    `;

    const finalResult = await ai.models.generateContent({
        model: getGeminiModel(),
        contents: finalAnalysisPrompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: factCheckReportSchema,
        },
    });
    const finalJsonString = finalResult.text.trim();
    const finalReport = parseAIJsonResponse(finalJsonString) as FactCheckReport;

    // Ensure searchEvidence is populated with the actual search results
    if (searchResults.length > 0) {
        finalReport.searchEvidence = {
            query: preliminaryAnalysis.claims[0]?.searchQuery || normalizedClaim.normalized_claim,
            results: searchResults.map(result => ({
                title: result.title,
                link: result.link,
                snippet: result.snippet,
                source: result.source
            }))
        };
    }

    return finalReport;
};

// --- Main Orchestrator ---
export async function runFactCheckOrchestrator(
  text: string,
  method: 'gemini-only' | 'google-ai' | 'hybrid' | 'citation-augmented'
): Promise<FactCheckReport> {
  const factDB = RealTimeFactDBService.getInstance();

  // Check fact database first for cached results
  const cachedFact = await factDB.getFact(text);
  if (cachedFact && isFactFresh(cachedFact)) {
    console.log('✅ Using cached fact from database');
    return await convertFactToReport(cachedFact, text);
  }

  // Proceed with original analysis if no cached result
  const report = await originalFactCheckOrchestrator(text, method);

  // Store result in fact database for future use
  try {
    await factDB.addFactFromReport(text, report);
    console.log('✅ Fact saved to database for future use');
  } catch (error) {
    console.error('Failed to save fact to database:', error);
  }

  return report;
}

function isFactFresh(fact: FactDatabase): boolean {
  const daysSinceVerification = (Date.now() - new Date(fact.verification.lastVerified).getTime()) / (1000 * 60 * 60 * 24);
  return daysSinceVerification < 7; // Consider facts fresh for 7 days
}

async function convertFactToReport(fact: FactDatabase, originalText: string): Promise<FactCheckReport> {
    const factCheckId = await generateSHA256(`cached-database::${originalText.trim().toLowerCase()}`);
  return {
    id: factCheckId,
    originalText,
    final_verdict: mapVerdictToString(fact.verdict),
    final_score: Math.round(fact.confidence * 100),
    evidence: fact.sources.map(source => ({
      id: Math.random().toString(36).substr(2, 9),
      publisher: source.publisher,
      quote: source.quote,
      url: source.url,
      score: source.credibilityScore,
      type: 'cached-database'
    })),
    score_breakdown: {
      final_score_formula: 'Cached from fact database',
      metrics: [
        {
          name: 'Cached Confidence',
          score: Math.round(fact.confidence * 100),
          description: 'Pre-verified fact from database'
        }
      ],
      confidence_intervals: {
        lower_bound: Math.max(0, Math.round(fact.confidence * 100) - 10),
        upper_bound: Math.min(100, Math.round(fact.confidence * 100) + 10)
      }
    },
    reasoning: `This claim was previously verified and cached in our fact database. Last verified: ${new Date(fact.verification.lastVerified).toLocaleDateString()}`,
    enhanced_claim_text: '',
    metadata: {
      method_used: 'cached-database',
      processing_time_ms: 50, // Very fast for cached results
      apis_used: ['fact-database'],
      sources_consulted: {
        total: fact.sources.length,
        high_credibility: fact.sources.filter(s => s.credibilityScore > 80).length,
        conflicting: 0
      },
      warnings: new Date(fact.verification.nextVerificationDue) < new Date() ? ['Fact may need re-verification'] : []
    }
  };
}

function mapVerdictToString(verdict: FactVerdict): string {
  const verdictMap = {
    'true': 'TRUE',
    'mostly-true': 'MOSTLY TRUE',
    'mixed': 'MIXED',
    'mostly-false': 'MOSTLY FALSE',
    'false': 'FALSE',
    'unverified': 'UNVERIFIED'
  };
  return verdictMap[verdict];
}

// Keep original function for new analysis
async function originalFactCheckOrchestrator(
    claimText: string,
    method: 'gemini-only' | 'google-ai' | 'hybrid' | 'citation-augmented',
    context?: string
): Promise<FactCheckReport> {
    const factCheckId = await generateSHA256(`${method}::${claimText.trim().toLowerCase()}`);
    const cacheKey = factCheckId;
    const cachedReport = factCheckCache.get(cacheKey);
    if (cachedReport) {
        console.log(`[Cache] Hit for key: ${cacheKey}`);
        return {
            ...cachedReport,
            metadata: {
                ...cachedReport.metadata,
                processing_time_ms: 0, // Indicate it's from cache
            }
        };
    }
    console.log(`[Cache] Miss for key: ${cacheKey}`);

    try {
        const startTime = Date.now();
        const normalizedClaim = await normalizeClaim(claimText);

        let report: FactCheckReport;

        switch (method) {
            case 'gemini-only':
                report = await enhancedFactCheck(claimText, method, () => runGeminiOnlyCheckWithFallback(normalizedClaim, context));
                break;
            case 'google-ai':
                report = await enhancedFactCheck(claimText, method, () => runGoogleSearchAndAiCheck(normalizedClaim, context));
                break;
            case 'hybrid':
                report = await enhancedFactCheck(claimText, method, () => runHybridCheck(normalizedClaim, context));
                break;
            case 'citation-augmented':
                report = await enhancedFactCheck(claimText, method, () => runCitationAugmentedCheck(normalizedClaim, context));
                break;
            default:
                throw new Error(`Unsupported analysis method: ${method}`);
        }

        report.id = factCheckId;
        report.metadata.processing_time_ms = Date.now() - startTime;
        report.originalText = claimText;
        
        // Store the successful result in the cache
        factCheckCache.set(cacheKey, report);
        
        return report;
    } catch (error) {
        console.error(`Error during fact-check orchestration with method '${method}':`, error);
        if (error instanceof Error && error.message.includes("API key")) {
            throw new Error(error.message);
        }
        if (error instanceof Error && error.message.includes('JSON')) {
             throw new Error("The AI model returned an invalid JSON structure. This may be a temporary issue.");
        }
        throw new Error("Failed to complete the analysis. The AI model may be temporarily unavailable or the request may have timed out.");
    }
};

// --- Legacy function for 'newsdata' method ---
export const fetchNewsData = async (query: string): Promise<NewsArticle[]> => {
    try {
        const apiKey = getNewsDataApiKey();
        const apiUrl = `https://newsdata.io/api/1/news?apikey=${apiKey}&q=${encodeURIComponent(query)}`;

        const response = await fetch(apiUrl);

        if (!response.ok) {
            const errorData = await response.json();
            console.error("newsdata.io API Error:", errorData);
            throw new Error(`newsdata.io API failed with status ${response.status}: ${errorData.results?.message || 'Unknown error'}`);
        }

        const data = await response.json();

        if (!data.results || data.results.length === 0) {
            return [];
        }

        const articles: NewsArticle[] = data.results.map((article: any) => ({
            title: article.title,
            link: article.link,
            description: article.description,
            pubDate: article.pubDate,
            source: article.source_id || 'Unknown Source',
        }));

        return articles;

    } catch (error) {
        console.error("Error fetching news data:", error);
        if (error instanceof Error && error.message.includes("API key")) {
            throw error;
        }
        throw new Error("Failed to fetch articles from newsdata.io API. Please check your API key in Settings.");
    }
};