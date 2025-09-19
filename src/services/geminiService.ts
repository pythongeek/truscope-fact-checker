// src/services/geminiService.ts - Enhanced version with guaranteed text segmentation

import { GoogleGenAI, Type } from "@google/genai";
import { FactCheckReport, ClaimNormalization, PreliminaryAnalysis } from '../types/factCheck';
import { getGeminiApiKey, getNewsDataApiKey } from './apiKeyService';
import { NewsArticle, GoogleSearchResult } from "../types";
import { factCheckCache } from './caching';
import { search } from './webSearch';
import { analyzeTextSegments } from './textAnalysisService';

// AI Client Setup
const getAiClient = () => {
    const apiKey = getGeminiApiKey();
    return new GoogleGenAI({ apiKey });
}

// Enhanced fact-check report schema that ensures text segments are included
const enhancedFactCheckReportSchema = {
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
                    color: { type: Type.STRING, enum: ['green', 'yellow', 'red', 'default'] }
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

// Normalize Claim
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

// Enhanced wrapper to ensure all reports have text segments
const ensureTextSegments = async (
    report: FactCheckReport,
    originalText: string,
    method: string
): Promise<FactCheckReport> => {
    if (!report.originalTextSegments || report.originalTextSegments.length === 0) {
        try {
            console.log(`Generating text segments for method: ${method}`);
            const segmentAnalysis = await analyzeTextSegments(originalText, report, method);
            return {
                ...report,
                originalTextSegments: segmentAnalysis.segments,
                metadata: {
                    ...report.metadata,
                    warnings: [
                        ...report.metadata.warnings,
                        'Text segmentation was generated post-analysis for enhanced visualization'
                    ]
                }
            };
        } catch (error) {
            console.error('Failed to generate text segments:', error);
            return report; // Return original report if segmentation fails
        }
    }
    return report;
};

const runGeminiOnlyCheck = async (normalizedClaim: ClaimNormalization, context?: string, originalText?: string): Promise<FactCheckReport> => {
    const ai = getAiClient();
    const prompt = `
        You are TruScope AI, an advanced fact-checking engine.
        Perform a deep analysis of the following claim based *only* on your internal knowledge base. Do not perform any external searches.
        Evaluate the claim's veracity, identify supporting or conflicting evidence from your training data, and assess the likely credibility of potential sources.
        
        Original Text: "${originalText || normalizedClaim.normalized_claim}"
        Normalized Claim: "${normalizedClaim.normalized_claim}"
        Keywords: ${normalizedClaim.keywords.join(', ')}
        ${context ? `Context: "${context}"` : ''}

        IMPORTANT: Break down the original text into segments and provide confidence scores for each segment.
        Each segment should be a meaningful phrase or sentence with a score from 0-100 and appropriate color coding.

        Construct a detailed FactCheckReport and respond ONLY with the JSON object that adheres to the provided schema.
    `;

    const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: enhancedFactCheckReportSchema,
        },
    });
    const jsonString = result.text.trim();
    const report = JSON.parse(jsonString) as any;
    report.originalText = originalText || normalizedClaim.normalized_claim;

    // Ensure text segments are available
    return await ensureTextSegments(report, originalText || normalizedClaim.normalized_claim, 'gemini-only');
};

const runGoogleSearchAndAiCheck = async (normalizedClaim: ClaimNormalization, context?: string, originalText?: string): Promise<FactCheckReport> => {
    const ai = getAiClient();
    const prompt = `
        You are TruScope AI, an advanced fact-checking engine.
        Your task is to verify the following claim *exclusively* using Google Search.
        Synthesize the search results to determine a verdict. Identify high-quality sources and extract key evidence.
        Do not use your internal knowledge; your analysis must be based solely on the provided search results.
        
        Original Text: "${originalText || normalizedClaim.normalized_claim}"
        Normalized Claim: "${normalizedClaim.normalized_claim}"
        Keywords for search: ${normalizedClaim.keywords.join(', ')}
        ${context ? `Context: "${context}"` : ''}

        IMPORTANT: Also analyze the original text and break it into segments with confidence scores.
        Use the search results to inform the scoring of each text segment.

        Construct a detailed FactCheckReport. Respond ONLY with a valid JSON object as a string that conforms to the enhanced schema.
    `;

    const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            tools: [{ googleSearch: {} }],
        },
    });

    let report: FactCheckReport;
    try {
        const jsonString = result.text.trim();
        report = JSON.parse(jsonString) as any;
        report.originalText = originalText || normalizedClaim.normalized_claim;
    } catch (error) {
        console.error('Failed to parse Google AI response, trying fallback analysis');
        // Fallback: create basic report structure
        report = await createFallbackReport(normalizedClaim, 'google-ai', originalText);
    }

    return await ensureTextSegments(report, originalText || normalizedClaim.normalized_claim, 'google-ai');
};

const runHybridCheck = async (normalizedClaim: ClaimNormalization, context?: string, originalText?: string): Promise<FactCheckReport> => {
    const ai = getAiClient();
    const prompt = `
        You are TruScope AI, an advanced fact-checking engine.
        Perform a comprehensive, hybrid analysis of the following claim.
        1. First, use your internal knowledge base to form a preliminary assessment.
        2. Then, use Google Search to find real-time, external evidence to corroborate, contradict, or contextualize your findings.
        3. Synthesize both internal knowledge and external search results to provide a final, nuanced verdict.
        
        Original Text: "${originalText || normalizedClaim.normalized_claim}"
        Normalized Claim: "${normalizedClaim.normalized_claim}"
        Keywords for search: ${normalizedClaim.keywords.join(', ')}
        ${context ? `Context: "${context}"` : ''}

        IMPORTANT: Break down the original text into segments and provide detailed confidence analysis for each part.
        Use both your internal knowledge and search results to score each segment appropriately.

        Construct a detailed FactCheckReport that reflects this hybrid methodology. Respond ONLY with a valid JSON object.
    `;

    const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            tools: [{ googleSearch: {} }],
        },
    });

    let report: FactCheckReport;
    try {
        const jsonString = result.text.trim();
        report = JSON.parse(jsonString) as any;
        report.originalText = originalText || normalizedClaim.normalized_claim;
    } catch (error) {
        console.error('Failed to parse Hybrid response, trying fallback analysis');
        report = await createFallbackReport(normalizedClaim, 'hybrid', originalText);
    }

    return await ensureTextSegments(report, originalText || normalizedClaim.normalized_claim, 'hybrid');
};

// Enhanced Citation-Augmented method (already includes text segmentation)
const runCitationAugmentedCheck = async (normalizedClaim: ClaimNormalization, context?: string, originalText?: string): Promise<FactCheckReport> => {
    const ai = getAiClient();

    // 1. Preliminary Analysis with enhanced text segmentation
    const preliminaryAnalysisPrompt = `
        You are a fact-checking AI assistant. Analyze the following text and provide a comprehensive preliminary analysis.

        Original Text: "${originalText || normalizedClaim.normalized_claim}"
        Normalized Claim: "${normalizedClaim.normalized_claim}"
        ${context ? `Context: "${context}"` : ''}

        Your task is to:
        1. Break down the text into verifiable claims.
        2. For each claim, provide a brief justification for why it needs checking.
        3. For each claim, generate a targeted Google search query to find verifying or disproving evidence.
        4. Break down the original text into meaningful segments (sentences or phrases) and assign preliminary confidence scores.
        5. Provide a preliminary overall verdict and score.

        Focus on creating high-quality, targeted search queries for authoritative sources like fact-checking sites, government sources, and reputable news outlets.

        Respond ONLY with a JSON object in the specified format.
    `;

    const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: preliminaryAnalysisPrompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: preliminaryAnalysisSchema,
        },
    });

    const jsonString = result.text.trim();
    const preliminaryAnalysis: PreliminaryAnalysis = JSON.parse(jsonString);

    // 2. External Evidence Gathering
    console.log("Starting targeted searches for verification...");
    const searchPromises = preliminaryAnalysis.claims.map(claim => search(claim.searchQuery, 5));
    const searchResultsByClaim = await Promise.all(searchPromises);
    const allSearchResults = searchResultsByClaim.flat();

    // Deduplicate results
    const uniqueResults = new Map<string, GoogleSearchResult>();
    for (const result of allSearchResults) {
        if (result && result.link && !uniqueResults.has(result.link)) {
            uniqueResults.set(result.link, result);
        }
    }
    const searchResults = Array.from(uniqueResults.values());

    console.log(`Found ${searchResults.length} unique external sources for verification.`);

    // 3. Final Analysis with enhanced text segmentation
    const finalAnalysisPrompt = `
        You are TruScope AI, an advanced fact-checking engine.
        You have performed a preliminary analysis and gathered external evidence. Now synthesize everything into a comprehensive report.

        **Original Text:** "${originalText || normalizedClaim.normalized_claim}"
        **Normalized Claim:** "${normalizedClaim.normalized_claim}"

        **Preliminary Analysis:**
        ${JSON.stringify(preliminaryAnalysis, null, 2)}

        **External Evidence (Search Results):**
        ${JSON.stringify(searchResults, null, 2)}

        **CRITICAL REQUIREMENTS:**
        1. **reasoning**: Provide detailed explanation of how external evidence informed your analysis.
        2. **originalTextSegments**: Transform preliminary text segments into color-coded segments:
           - Update scores based on external evidence
           - Assign colors: 75-100='green', 40-74='yellow', 0-39='red', neutral='default'
           - Ensure segments cover the entire original text
        3. **evidence**: Include evidence from external search results with real URLs.
        4. **searchEvidence**: Populate with actual search results found.

        Respond ONLY with a valid JSON object that conforms to the FactCheckReport schema.
    `;

    const finalResult = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: finalAnalysisPrompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: enhancedFactCheckReportSchema,
        },
    });

    const finalJsonString = finalResult.text.trim();
    const finalReport = JSON.parse(finalJsonString) as any;
    finalReport.originalText = originalText || normalizedClaim.normalized_claim;

    // Ensure searchEvidence is populated
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

    // Final fallback to ensure text segments exist
    return await ensureTextSegments(finalReport, originalText || normalizedClaim.normalized_claim, 'citation-augmented');
};

// Fallback report generator
const createFallbackReport = async (
    normalizedClaim: ClaimNormalization,
    method: string,
    originalText?: string
): Promise<FactCheckReport> => {
    const text = originalText || normalizedClaim.normalized_claim;

    return {
        originalText: text,
        final_verdict: "Analysis Incomplete",
        final_score: 50,
        score_breakdown: {
            final_score_formula: "Fallback analysis due to processing error",
            metrics: [
                {
                    name: "Source Reliability",
                    score: 50,
                    description: "Unable to assess due to processing error"
                }
            ]
        },
        evidence: [
            {
                id: "fallback-1",
                publisher: "Internal Analysis",
                url: null,
                quote: "Analysis could not be completed due to technical issues.",
                score: 50,
                type: "claim"
            }
        ],
        metadata: {
            method_used: method,
            processing_time_ms: 0,
            apis_used: ["Gemini AI"],
            sources_consulted: { total: 0, high_credibility: 0, conflicting: 0 },
            warnings: ["Analysis failed - using fallback report structure"]
        },
        originalTextSegments: undefined, // Will be populated by ensureTextSegments
        reasoning: "This is a fallback analysis due to processing errors. Please try running the analysis again."
    };
};

// Enhanced Main Orchestrator
export const runFactCheckOrchestrator = async (
    claimText: string,
    method: 'gemini-only' | 'google-ai' | 'hybrid' | 'citation-augmented',
    context?: string
): Promise<FactCheckReport> => {
    const cacheKey = `${method}::${claimText.trim().toLowerCase()}`;
    const cachedReport = factCheckCache.get(cacheKey);
    if (cachedReport) {
        console.log(`[Cache] Hit for key: ${cacheKey}`);
        // Ensure cached reports also have text segments
        return await ensureTextSegments({
            ...cachedReport,
            metadata: {
                ...cachedReport.metadata,
                processing_time_ms: 0, // Indicate it's from cache
            }
        }, claimText, method);
    }
    console.log(`[Cache] Miss for key: ${cacheKey}`);

    try {
        const startTime = Date.now();
        const normalizedClaim = await normalizeClaim(claimText);

        let report: FactCheckReport;

        switch (method) {
            case 'gemini-only':
                report = await runGeminiOnlyCheck(normalizedClaim, context, claimText);
                break;
            case 'google-ai':
                report = await runGoogleSearchAndAiCheck(normalizedClaim, context, claimText);
                break;
            case 'hybrid':
                report = await runHybridCheck(normalizedClaim, context, claimText);
                break;
            case 'citation-augmented':
                report = await runCitationAugmentedCheck(normalizedClaim, context, claimText);
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

// Legacy function for 'newsdata' method
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
