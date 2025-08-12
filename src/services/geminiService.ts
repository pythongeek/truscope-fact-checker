// This declaration satisfies TypeScript for process.env.API_KEY,
// which is replaced by Vite's define plugin at build time.
// This is necessary to avoid TypeScript errors regarding undefined environment variables.
declare const process: {
    env: {
        readonly API_KEY: string | undefined; // Mark as undefined to be explicit, then handle with '!'
    };
};

import { GoogleGenAI, GenerateContentResponse, GroundingChunk } from "@google/genai";
import type { AnalysisResult, Source } from '../types';

// Ensure the API_KEY environment variable is set. If not, throw an error.
// This check should ideally happen during application startup or build phase.
if (!process.env.API_KEY) {
    throw new Error("GEMINI_API_KEY environment variable not set. Please ensure it is correctly configured.");
}

// Initialize the GoogleGenAI client with the API key.
// The '!' non-null assertion is used here because we've already checked if API_KEY is defined above.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

/**
 * Constructs the prompt for the Gemini model to perform deep analysis on an article.
 * The prompt includes detailed instructions and the expected JSON output schema.
 * @param articleText The content of the article to be analyzed.
 * @returns A string representing the structured prompt for the AI.
 */
function buildPrompt(articleText: string): string {
    return `
You are TruScope, a sophisticated AI fact-checker. Your mission is to conduct a thorough, unbiased analysis of the provided news article using Google Search for verification.

Produce a single, valid JSON object as your response. Do not include any text or markdown formatting outside of the JSON. Ensure there are no trailing commas.

**JSON Output Structure and Instructions:**

Please populate the following JSON structure based on your analysis.

{
  "factual_accuracy_score": /* An integer from 0-100 representing the factual accuracy of the article. */,
  "misinformation_risk": /* An integer from 0-100 indicating the risk of misinformation. */,
  "news_standards_score": /* An integer from 0-100 for adherence to journalistic standards. */,
  "overall_summary": "A brief, 2-3 sentence summary of your findings, including the quality and bias of sources found via Google Search.",
  "claims": [
    {
      "claim_text": "The exact factual claim extracted from the article.",
      "status": "One of: 'Verified', 'False', 'Misleading', 'Opinion', 'Needs Verification'.",
      "confidence": /* An integer from 0-100 representing your confidence in the status. */,
      "explanation": "Briefly explain the reasoning for the status, citing source consistency. Be concise (1-2 sentences).",
      "consensus_status": "One of: 'High Consensus', 'Conflicting Reports', 'Single Source', 'No Sources Found'.",
      "is_anomaly": /* A boolean (true/false) if the claim is a statistical outlier or unusual. */,
      "sources": [
        {
          "title": "Title of the source found via Google Search.",
          "url": "Provide the final destination URL of the source. IMPORTANT: It MUST NOT be a 'google.com' or 'vertexaisearch.cloud.google.com' redirect URL.",
          "source_type": "Categorize the source (e.g., 'Reputable News', 'Academic Journal', 'Press Release').",
          "credibility_score": /* An integer from 0-100 for source credibility. */,
          "bias_rating": "Political or other bias (e.g., 'Center', 'Left-Leaning', 'Pro-Corporate')."
        }
      ]
    }
  ],
  "misinformation_alerts": [
    {
      "type": "Type of alert (e.g., 'Sensationalism', 'Emotional Language', 'Vague Sourcing').",
      "text": "The specific text from the article that triggered the alert.",
      "explanation": "Why this text is a red flag for misinformation. Be concise (1-2 sentences)."
    }
  ],
  "editorial_suggestions": [
    "Actionable suggestion to improve the article's quality. Each suggestion should be concise."
  ],
  "enhanced_article_html": "An HTML version of the article with these enhancements. Preserve original paragraphs (<p>) and line breaks (<br>). Rules: 1. **Verified Correct**: Wrap in <b>tags</b>. 2. **Incorrect**: Replace with <del>old text</del><ins>new correct text</ins>. 3. **Misleading/Opinion**: Wrap in <mark title=\\"Explain why it is marked here. Escape all quotes. Keep the explanation brief.\\">the misleading text</mark>. Do not add any <a> tags.",
  "news_standards_analysis": {
    "accuracy": /* Integer score 0-100. */,
    "sourcing": /* Integer score 0-100. */,
    "neutrality": /* Integer score 0-100. */,
    "depth": /* Integer score 0-100. */
  },
  "deep_analysis": {
    "logical_fallacies": [
      {
        "name": "Name of the logical fallacy (e.g., 'Ad Hominem', 'Straw Man'). If none, this array is empty.",
        "text": "The text containing the fallacy.",
        "explanation": "Why this constitutes the fallacy. Be concise (1-2 sentences)."
      }
    ],
    "propaganda_techniques": [
      {
        "name": "Name of the propaganda technique (e.g., 'Bandwagon'). If none, this array is empty.",
        "text": "The text using the technique.",
        "explanation": "Why this is an example of the technique. Be concise (1-2 sentences)."
      }
    ]
  },
  "claim_review_json_ld": "A JSON-LD string for a schema.org ClaimReview. This must be a string, so all internal quotes must be escaped (e.g., \\"key\\": \\"value\\"). Base it on the article's most significant claim. Set the author to an Organization named 'TruScope AI Fact-Checker'."
}

**Article to Analyze:**
---
${articleText}
---
`;
}

/**
 * Parses the JSON response from the Gemini model, handling common formatting issues.
 * This function attempts to extract valid JSON even if it's wrapped in markdown or contains comments/trailing commas.
 * @param responseText The raw text response from the Gemini model.
 * @returns The parsed JavaScript object.
 * @throws Error if the JSON response cannot be parsed.
 */
function parseJsonResponse(responseText: string): any {
    try {
        let textToParse = responseText;

        // Attempt to extract content wrapped in markdown code blocks (e.g., ```json ... ```)
        const markdownMatch = textToParse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (markdownMatch && markdownMatch[1]) {
            textToParse = markdownMatch[1];
        } else {
            // If no markdown block, try to find the content between the first and last curly brace
            const startIndex = textToParse.indexOf('{');
            const endIndex = textToParse.lastIndexOf('}');
            if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
                textToParse = textToParse.substring(startIndex, endIndex + 1);
            }
        }
        
        let cleanText = textToParse.trim();
        
        // Remove single-line and multi-line comments that the model might include
        cleanText = cleanText.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1');
        
        // Remove trailing commas, which are not allowed in strict JSON
        cleanText = cleanText.replace(/,\s*([}\]])/g, '$1');

        return JSON.parse(cleanText);
    } catch (e) {
        console.error("Failed to parse JSON response:", responseText);
        if (e instanceof Error) {
            console.error("Parsing error details:", e.message);
        }
        // Provide a user-friendly error message for invalid AI responses
        throw new Error("AI returned an invalid response format. This might be due to an issue with the model's output or rate limiting. Please try again later.");
    }
}

/**
 * Performs a deep analysis of the provided article text using the Gemini model and Google Search.
 * It builds a prompt, sends it to the AI, parses the response, and structures the results.
 * @param articleText The content of the article to analyze.
 * @returns A Promise that resolves to an AnalysisResult object.
 */
export async function performDeepAnalysis(articleText: string): Promise<AnalysisResult> {
    const prompt = buildPrompt(articleText);
    
    // Call the Gemini API with the prompt and enable Google Search as a tool.
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash', // Using gemini-2.5-flash for speed and cost-effectiveness
        contents: [{ role: 'user', parts: [{ text: prompt }] }], // Wrap prompt in contents format
        tools: [{ googleSearch: {} }], // Enable Google Search
    });

    // Check if response.text is defined before attempting to parse it.
    if (response.text === undefined) {
        throw new Error("AI response text was undefined. No analysis data received.");
    }

    // Parse the AI's text response into a JavaScript object.
    const parsedJson = parseJsonResponse(response.text);

    // Extract grounding sources (URLs) used by Google Search from the response metadata.
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    
    const groundingSources: Source[] = groundingChunks
      .map((chunk: GroundingChunk) => {
        const title = chunk.web?.title;
        const url = chunk.web?.uri;
        // Filter out incomplete or invalid source entries
        if (!title || !url || url.includes('google.com') || url.includes('vertexaisearch.cloud.google.com')) {
          return null;
        }
        return {
          title: title,
          url: url,
        };
      })
      .filter((source): source is Source => source !== null); // Type guard to filter out nulls

    // Remove duplicate sources based on their URL to present unique sources.
    const uniqueGroundingSources = Array.from(new Map(groundingSources.map(item => [item.url, item])).values());
    
    // Ensure all expected nested arrays/objects exist in the parsed JSON to prevent runtime errors
    // when accessing properties that might not have been generated by the model.
    if (!parsedJson.claims) parsedJson.claims = [];
    parsedJson.claims.forEach((claim: any) => {
        if (!claim.sources) claim.sources = [];
    });
    
    if (!parsedJson.misinformation_alerts) parsedJson.misinformation_alerts = [];
    if (!parsedJson.editorial_suggestions) parsedJson.editorial_suggestions = [];
    // The main grounding_sources are handled separately, so this default is for the AI's internal list
    if (!parsedJson.grounding_sources) parsedJson.grounding_sources = []; 
    
    if (!parsedJson.deep_analysis) {
        parsedJson.deep_analysis = { logical_fallacies: [], propaganda_techniques: [] };
    }
    if (!parsedJson.deep_analysis.logical_fallacies) parsedJson.deep_analysis.logical_fallacies = [];
    if (!parsedJson.deep_analysis.propaganda_techniques) parsedJson.deep_analysis.propaganda_techniques = [];
    
    // Ensure claim_review_json_ld is always a string, defaulting to an empty JSON object string if not present.
    if (!parsedJson.claim_review_json_ld) parsedJson.claim_review_json_ld = "{}";

    // Return the combined analysis result, overriding the AI's grounding sources with the extracted ones.
    return { ...parsedJson, grounding_sources: uniqueGroundingSources };
}
