
import { GoogleGenAI, GenerateContentResponse, GroundingChunk } from "@google/genai";
import type { AnalysisResult, Source } from '../types';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

function buildPrompt(articleText: string): string {
    // This prompt is structured to be clearer and less prone to causing internal server errors.
    // It combines instructions with the desired schema for better model comprehension.
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

function parseJsonResponse(responseText: string): any {
    try {
        // Clean the response: remove markdown, comments and trailing commas
        let cleanText = responseText
            .replace(/^```json\s*|```$/g, '')
            .replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1') // remove comments
            .trim();
        
        // A more robust way to remove trailing commas
        cleanText = cleanText.replace(/,\s*([}\]])/g, '$1');
        return JSON.parse(cleanText);
    } catch (e) {
        console.error("Failed to parse JSON response:", responseText);
        throw new Error("AI returned an invalid response format. The content may be blocked or the model is generating non-JSON output.");
    }
}


export async function performDeepAnalysis(articleText: string): Promise<AnalysisResult> {
    const prompt = buildPrompt(articleText);
    
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            tools: [{ googleSearch: {} }],
        }
    });

    const parsedJson = parseJsonResponse(response.text);

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    
    // Create direct links from grounding sources
    const groundingSources: Source[] = groundingChunks
      .map((chunk: GroundingChunk) => {
        const title = chunk.web?.title;
        const url = chunk.web?.uri;
        if (!title || !url) {
          return null;
        }
        return {
          title: title,
          url: url,
        };
      })
      .filter((source): source is Source => source !== null);

    // Remove duplicate sources
    const uniqueGroundingSources = Array.from(new Map(groundingSources.map(item => [item.url, item])).values());
    
    // Ensure all nested arrays/objects exist to prevent render errors
    if(parsedJson.claims) {
        parsedJson.claims.forEach((claim: any) => {
            if (!claim.sources) {
                claim.sources = [];
            }
        });
    } else {
        parsedJson.claims = [];
    }
     if (!parsedJson.misinformation_alerts) parsedJson.misinformation_alerts = [];
     if (!parsedJson.editorial_suggestions) parsedJson.editorial_suggestions = [];
     if (!parsedJson.grounding_sources) parsedJson.grounding_sources = [];
     if (!parsedJson.deep_analysis) {
        parsedJson.deep_analysis = {
            logical_fallacies: [],
            propaganda_techniques: []
        };
     }
     if (!parsedJson.deep_analysis.logical_fallacies) parsedJson.deep_analysis.logical_fallacies = [];
     if (!parsedJson.deep_analysis.propaganda_techniques) parsedJson.deep_analysis.propaganda_techniques = [];
     if (!parsedJson.claim_review_json_ld) parsedJson.claim_review_json_ld = "{}";


    return { ...parsedJson, grounding_sources: uniqueGroundingSources };
}
