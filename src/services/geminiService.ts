import { GoogleGenAI, Type } from "@google/genai";
import { FactCheckReport, ClaimNormalization } from '../types/factCheck';
import { getGeminiApiKey, getNewsDataApiKey } from './apiKeyService';
import { NewsArticle } from "../types";
import { factCheckCache } from './caching';

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
        }
    },
    required: ['final_verdict', 'final_score', 'score_breakdown', 'evidence', 'metadata']
};

// --- Orchestration Steps ---

// 1. Normalize Claim
const normalizeClaim = async (claimText: string): Promise<ClaimNormalization> => {
    try {
        const ai = getAiClient();
        const result = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Analyze the following text and extract the core factual claim. Normalize the claim into a clear, verifiable statement. Also, identify up to 5 key search terms or entities. Respond ONLY with a JSON object matching this schema: \`{"original_claim": string, "normalized_claim": string, "keywords": string[]}\`. Text: "${claimText}"`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        original_claim: { type: Type.STRING },
                        normalized_claim: { type: Type.STRING },
                        keywords: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ['original_claim', 'normalized_claim', 'keywords']
                },
            },
        });
        const jsonString = result.text.trim();
        return JSON.parse(jsonString) as ClaimNormalization;
    } catch (error) {
        console.error("Error normalizing claim:", error);
        throw new Error("Failed to normalize the claim using the AI model.");
    }
};

// --- Verification Methods ---

const runGeminiOnlyCheck = async (normalizedClaim: ClaimNormalization, context?: string): Promise<FactCheckReport> => {
    const ai = getAiClient();
    const prompt = `
        You are TruScope AI, an advanced fact-checking engine.
        Perform a deep analysis of the following claim based *only* on your internal knowledge base. Do not perform any external searches.
        Evaluate the claim's veracity, identify supporting or conflicting evidence from your training data, and assess the likely credibility of potential sources.
        
        Claim: "${normalizedClaim.normalized_claim}"
        Keywords: ${normalizedClaim.keywords.join(', ')}
        ${context ? `Context: "${context}"` : ''}

        Construct a detailed FactCheckReport and respond ONLY with the JSON object that adheres to the provided schema.
    `;
    const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: factCheckReportSchema,
        },
    });
    const jsonString = result.text.trim();
    return JSON.parse(jsonString) as FactCheckReport;
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
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            tools: [{ googleSearch: {} }],
        },
    });
    const jsonString = result.text.trim();
    return JSON.parse(jsonString) as FactCheckReport;
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
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            tools: [{ googleSearch: {} }],
        },
    });
    const jsonString = result.text.trim();
    return JSON.parse(jsonString) as FactCheckReport;
};

// --- Main Orchestrator ---
export const runFactCheckOrchestrator = async (
    claimText: string,
    method: 'gemini-only' | 'google-ai' | 'hybrid',
    context?: string
): Promise<FactCheckReport> => {
    const cacheKey = `${method}::${claimText.trim().toLowerCase()}`;
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
                report = await runGeminiOnlyCheck(normalizedClaim, context);
                break;
            case 'google-ai':
                report = await runGoogleSearchAndAiCheck(normalizedClaim, context);
                break;
            case 'hybrid':
                report = await runHybridCheck(normalizedClaim, context);
                break;
            default:
                throw new Error(`Unsupported analysis method: ${method}`);
        }

        report.metadata.processing_time_ms = Date.now() - startTime;
        
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
        // Truncate query to a safe length for the free tier (max 100 chars)
        const truncatedQuery = query.substring(0, 90);
        const apiUrl = `https://newsdata.io/api/1/latest?apikey=${apiKey}&q=${encodeURIComponent(truncatedQuery)}`;

        const response = await fetch(apiUrl);

        if (!response.ok) {
            const errorData = await response.json();
            console.error("newsdata.io API Error:", errorData);
            // Provide a more specific error for the known query length issue
            if (response.status === 422 && errorData.results?.message?.includes("length")) {
                 throw new Error("Analysis Failed: The claim is too long for the newsdata.io plan. Please use a shorter query.");
            }
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
        if (error instanceof Error && (error.message.includes("API key") || error.message.startsWith("Analysis Failed"))) {
            throw error;
        }
        throw new Error("Failed to fetch articles from newsdata.io API. Please check your API key in Settings.");
    }
};
