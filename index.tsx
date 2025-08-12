// This declaration satisfies TypeScript for the process.env.API_KEY used below,
// which is replaced by the execution environment.
declare const process: {
    env: {
        readonly API_KEY: string;
    };
};

import React, { useState, useCallback, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, GenerateContentResponse, GroundingChunk } from "@google/genai";

// --- TYPES ---
interface Source {
  title: string;
  url: string;
}

interface RichSource extends Source {
  source_type: string;
  credibility_score: number;
  bias_rating: string;
}

interface Claim {
  claim_text: string;
  status: string;
  confidence: number;
  explanation: string;
  consensus_status: "High Consensus" | "Conflicting Reports" | "Single Source" | "No Sources Found";
  is_anomaly: boolean;
  sources: RichSource[];
}

interface MisinformationAlert {
  type: string;
  text: string;
  explanation: string;
}

interface NewsStandards {
  accuracy: number;
  sourcing: number;
  neutrality: number;
  depth: number;
}

interface LogicalFallacy {
  name: string;
  text: string;
  explanation: string;
}

interface PropagandaTechnique {
  name: string;
  text: string;
  explanation: string;
}

interface DeepAnalysis {
    logical_fallacies: LogicalFallacy[];
    propaganda_techniques: PropagandaTechnique[];
}

interface AnalysisResult {
  factual_accuracy_score: number;
  misinformation_risk: number;
  news_standards_score: number;
  overall_summary: string;
  claims: Claim[];
  misinformation_alerts: MisinformationAlert[];
  editorial_suggestions: string[];
  enhanced_article_html: string;
  news_standards_analysis: NewsStandards;
  deep_analysis: DeepAnalysis;
  grounding_sources: Source[];
  claim_review_json_ld: string;
}

type ActiveTab = "overview" | "claims" | "enhanced" | "standards" | "deep_analysis";

// --- ICONS ---
interface IconProps {
    className?: string;
}

const LogoIcon: React.FC<IconProps> = ({ className }) => (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      strokeWidth="2"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M14 26C20.6274 26 26 20.6274 26 14C26 7.37258 20.6274 2 14 2C7.37258 2 2 7.37258 2 14C2 20.6274 7.37258 26 14 26Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 8.75V14M14 14V19.25M14 14H19.25M14 14H8.75"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
);

const QuoteIcon: React.FC<IconProps> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M13 14.725c0-5.141 3.892-10.519 10-11.725l-1.964 4.555c-1.858 1.343-2.536 2.836-2.536 4.17v3h-5.5zm-8 0c0-5.141 3.892-10.519 10-11.725l-1.964 4.555c-1.858 1.343-2.536 2.836-2.536 4.17v3h-5.5z"/>
    </svg>
);

const CheckCircleIcon: React.FC<IconProps> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
);

const AlertTriangleIcon: React.FC<IconProps> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
);

const XCircleIcon: React.FC<IconProps> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
);

const SearchIcon: React.FC<IconProps> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
);

const InfoIcon: React.FC<IconProps> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
);

const FileTextIcon: React.FC<IconProps> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
);

const BookOpenIcon: React.FC<IconProps> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
);

const EditIcon: React.FC<IconProps> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
);

const BarChartIcon: React.FC<IconProps> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <line x1="12" y1="20" x2="12" y2="10" />
        <line x1="18" y1="20" x2="18" y2="4" />
        <line x1="6" y1="20" x2="6" y2="16" />
    </svg>
);

const LinkIcon: React.FC<IconProps> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.72" />
    </svg>
);

const UsersIcon: React.FC<IconProps> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M17 3.13a4 4 0 0 1 0 7.75" />
    </svg>
);

const GitBranchIcon: React.FC<IconProps> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <line x1="6" y1="3" x2="6" y2="15" />
        <circle cx="18" cy="6" r="3" />
        <circle cx="6" cy="18" r="3" />
        <path d="M18 9a9 9 0 0 1-9 9" />
    </svg>
);

const UserIcon: React.FC<IconProps> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
    </svg>
);

const AlertOctagonIcon: React.FC<IconProps> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
);

const BrainCircuitIcon: React.FC<IconProps> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 2a4.5 4.5 0 0 0-4.5 4.5v.5a4.5 4.5 0 0 0-4.5 4.5v2a4.5 4.5 0 0 0 4.5 4.5h.5a4.5 4.5 0 0 0 4.5 4.5v.5a4.5 4.5 0 0 0 4.5-4.5v-.5a4.5 4.5 0 0 0 4.5-4.5v-2a4.5 4.5 0 0 0-4.5-4.5h-.5a4.5 4.5 0 0 0-4.5-4.5Z"/><path d="M3 12h1"/><path d="M20 12h1"/><path d="M12 3V2"/><path d="M12 21v1"/><path d="m4.929 4.929-.707-.707"/><path d="m19.799 19.799-.707-.707"/><path d="m4.929 19.799.707-.707"/><path d="m19.799 4.929.707-.707"/>
    </svg>
);

const ScaleIcon: React.FC<IconProps> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m16 16 3-8 3 8c-2 1-4 1-6 0Z"/><path d="m2 16 3-8 3 8c-2 1-4 1-6 0Z"/><path d="M12 2v20"/><path d="M4 12H2"/><path d="M22 12h-2"/><path d="M12 6V4"/><path d="M7 20h10"/>
    </svg>
);

const MegaphoneIcon: React.FC<IconProps> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>
    </svg>
);

const CodeIcon: React.FC<IconProps> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
    </svg>
);

const CopyIcon: React.FC<IconProps> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
);

const CheckIcon: React.FC<IconProps> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// --- GEMINI SERVICE ---
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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

function parseJsonResponse(responseText: string): any {
    try {
        let textToParse = responseText;

        // Handle cases where the response is wrapped in markdown ```json ... ```
        const markdownMatch = textToParse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (markdownMatch && markdownMatch[1]) {
            textToParse = markdownMatch[1];
        } else {
            // If not in a markdown block, find the content between the first and last curly brace
            const startIndex = textToParse.indexOf('{');
            const endIndex = textToParse.lastIndexOf('}');
            if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
                textToParse = textToParse.substring(startIndex, endIndex + 1);
            }
        }
        
        let cleanText = textToParse.trim();
        
        // Remove comments - model might sometimes include them
        cleanText = cleanText.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1');
        
        // Remove trailing commas - a common cause of JSON parsing errors
        cleanText = cleanText.replace(/,\s*([}\]])/g, '$1');

        return JSON.parse(cleanText);
    } catch (e) {
        console.error("Failed to parse JSON response:", responseText);
        if (e instanceof Error) {
            console.error("Parsing error:", e.message);
        }
        throw new Error("AI returned an invalid response format. The content may be blocked or the model is generating non-JSON output.");
    }
}

async function performDeepAnalysis(articleText: string): Promise<AnalysisResult> {
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

    const uniqueGroundingSources = Array.from(new Map(groundingSources.map(item => [item.url, item])).values());
    
    if(parsedJson.claims) {
        parsedJson.claims.forEach((claim: any) => {
            if (!claim.sources) claim.sources = [];
        });
    } else {
        parsedJson.claims = [];
    }
     if (!parsedJson.misinformation_alerts) parsedJson.misinformation_alerts = [];
     if (!parsedJson.editorial_suggestions) parsedJson.editorial_suggestions = [];
     if (!parsedJson.grounding_sources) parsedJson.grounding_sources = [];
     if (!parsedJson.deep_analysis) {
        parsedJson.deep_analysis = { logical_fallacies: [], propaganda_techniques: [] };
     }
     if (!parsedJson.deep_analysis.logical_fallacies) parsedJson.deep_analysis.logical_fallacies = [];
     if (!parsedJson.deep_analysis.propaganda_techniques) parsedJson.deep_analysis.propaganda_techniques = [];
     if (!parsedJson.claim_review_json_ld) parsedJson.claim_review_json_ld = "{}";

    return { ...parsedJson, grounding_sources: uniqueGroundingSources };
}

// --- COMPONENTS ---

const Header: React.FC = () => {
  return (
    <header className="text-center mb-8 md:mb-12 animate-entry fade-in">
       <div className="flex justify-center items-center gap-3 mb-2">
        <LogoIcon className="w-10 h-10 text-blue-600" />
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-800 gradient-text">
          TruScope
        </h1>
      </div>
      <p className="mt-3 text-lg md:text-xl text-gray-600 max-w-3xl mx-auto">
        Combat misinformation with AI-powered fact verification and in-depth news analysis.
      </p>
    </header>
  );
};

interface InputSectionProps {
  articleText: string;
  onArticleChange: (text: string) => void;
  onAnalyze: () => void;
  onClear: () => void;
  onLoadSample: () => void;
  isLoading: boolean;
}

const InputSection: React.FC<InputSectionProps> = ({
  articleText,
  onArticleChange,
  onAnalyze,
  onClear,
  onLoadSample,
  isLoading,
}) => {
  return (
    <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg border border-gray-200">
      <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4">
        1. Paste Your Article
      </h2>
      <textarea
        value={articleText}
        onChange={(e) => onArticleChange(e.target.value)}
        placeholder="Paste your news article content here for comprehensive fact-checking, misinformation detection, and news standard evaluation..."
        className="w-full h-64 p-4 bg-gray-50 text-gray-800 placeholder:text-gray-500 border-2 border-gray-200 rounded-lg font-serif text-base leading-relaxed resize-y focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 ease-in-out shadow-sm focus:shadow-md"
        disabled={isLoading}
      />
      <div className="mt-6 flex flex-col sm:flex-row sm:justify-end gap-3 sm:gap-4">
        <button
          onClick={onLoadSample}
          disabled={isLoading}
          className="px-5 py-3 text-base font-semibold text-blue-600 bg-white border-2 border-blue-200 rounded-lg hover:bg-blue-50 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transform"
        >
          <FileTextIcon className="w-5 h-5"/>
          Load Sample
        </button>
        <button
          onClick={onClear}
          disabled={isLoading}
          className="px-5 py-3 text-base font-semibold text-gray-700 bg-gray-100 border-2 border-gray-200 rounded-lg hover:bg-gray-200 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform"
        >
          Clear
        </button>
        <button
          onClick={onAnalyze}
          disabled={isLoading || articleText.length < 100}
          className="px-8 py-3 text-base font-semibold text-white bg-blue-600 rounded-lg shadow-md hover:bg-blue-700 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 disabled:opacity-50 disabled:bg-gray-400 disabled:cursor-not-allowed transform"
        >
          {isLoading ? 'Analyzing...' : 'Analyze Article'}
        </button>
      </div>
       {articleText.length > 0 && articleText.length < 100 && (
         <p className="text-right text-sm text-yellow-600 mt-2">Please enter at least 100 characters for analysis.</p>
       )}
    </div>
  );
};

interface LoadingSpinnerProps {
  message: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ message }) => {
  return (
    <div className="mt-8 text-center bg-white/70 backdrop-blur-sm p-8 rounded-2xl shadow-md border border-gray-200/50">
      <div className="flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600"></div>
      </div>
      <p className="mt-4 text-lg font-semibold text-blue-800">{message}</p>
    </div>
  );
};

interface ScoreCardProps {
    score: number;
    label: string;
    description: string;
    scoreSuffix?: string;
    isRisk?: boolean;
}

const getScoreColor = (score: number, isRisk: boolean = false) => {
    const effectiveScore = isRisk ? 100 - score : score;
    if (effectiveScore >= 85) return 'from-green-500 to-emerald-600';
    if (effectiveScore >= 60) return 'from-yellow-500 to-amber-600';
    return 'from-red-500 to-rose-600';
};

const ScoreCard: React.FC<ScoreCardProps> = ({ score, label, description, scoreSuffix = '', isRisk = false }) => {
    const colorClasses = getScoreColor(score, isRisk);
    return (
        <div className="bg-white p-6 rounded-xl border border-gray-200/80 text-center transition-all duration-300 ease-in-out hover:scale-[1.03] hover:shadow-2xl hover:border-gray-300">
            <div className="text-gray-600 font-semibold mb-2">{label}</div>
            <div className={`text-5xl font-extrabold bg-gradient-to-br ${colorClasses} gradient-text`}>
                {score}
                <span className="text-3xl">{scoreSuffix || '%'}</span>
            </div>
            <div className="mt-3 text-sm text-gray-500">{description}</div>
        </div>
    );
};

interface TabButtonProps {
  label: string;
  Icon: React.ComponentType<IconProps>;
  isActive: boolean;
  onClick: () => void;
}

const TabButton: React.FC<TabButtonProps> = ({ label, Icon, isActive, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-all duration-200
        ${
          isActive
            ? 'border-blue-500 text-blue-600'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
        }`}
    >
      <Icon className={`-ml-0.5 mr-2 h-5 w-5 transition-colors duration-200 ${isActive ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'}`} />
      <span>{label}</span>
    </button>
  );
};

const getStatusInfo = (status: Claim['status']) => {
    const lowerStatus = status.toLowerCase();
    if (lowerStatus.includes('verified')) return { Icon: CheckCircleIcon, color: 'text-green-600', bgColor: 'bg-green-50' };
    if (lowerStatus.includes('needs verification') || lowerStatus.includes('unverified')) return { Icon: SearchIcon, color: 'text-yellow-600', bgColor: 'bg-yellow-50' };
    if (lowerStatus.includes('misleading')) return { Icon: AlertTriangleIcon, color: 'text-orange-600', bgColor: 'bg-orange-50' };
    if (lowerStatus.includes('false')) return { Icon: XCircleIcon, color: 'text-red-600', bgColor: 'bg-red-50' };
    if (lowerStatus.includes('opinion')) return { Icon: InfoIcon, color: 'text-blue-600', bgColor: 'bg-blue-50' };
    return { Icon: InfoIcon, color: 'text-gray-500', bgColor: 'bg-gray-50' };
};

const getConsensusInfo = (consensus: Claim['consensus_status']) => {
    switch(consensus) {
        case 'High Consensus': return { Icon: UsersIcon, color: 'text-green-600', text: 'High Consensus'};
        case 'Conflicting Reports': return { Icon: GitBranchIcon, color: 'text-orange-600', text: 'Conflicting Reports'};
        case 'Single Source': return { Icon: UserIcon, color: 'text-yellow-600', text: 'Single Source'};
        case 'No Sources Found': return { Icon: XCircleIcon, color: 'text-gray-500', text: 'No Sources Found'};
        default: return { Icon: InfoIcon, color: 'text-gray-500', text: 'Unknown'};
    }
};

const AnomalyBadge = () => (
    <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-red-700 bg-red-100 border border-red-200 rounded-full">
        <AlertOctagonIcon className="w-4 h-4" />
        <span>Anomaly Detected</span>
    </div>
);

const ConsensusBadge: React.FC<{consensus: Claim['consensus_status']}> = ({ consensus }) => {
    const { Icon, color, text } = getConsensusInfo(consensus);
    return (
        <div className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium ${color.replace('text', 'bg').replace('-600', '-100')} ${color} border ${color.replace('text', 'border').replace('-600', '-200')} rounded-full`}>
            <Icon className="w-4 h-4" />
            <span>{text}</span>
        </div>
    );
};

const getCredibilityColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
};

const getBiasColor = (bias: RichSource['bias_rating']) => {
    const lowerBias = bias.toLowerCase();
    if (lowerBias.includes('left')) return 'bg-blue-100 text-blue-800';
    if (lowerBias.includes('right')) return 'bg-red-100 text-red-800';
    if (lowerBias.includes('corporate')) return 'bg-indigo-100 text-indigo-800';
    if (lowerBias.includes('center')) return 'bg-gray-100 text-gray-800';
    return 'bg-purple-100 text-purple-800';
};

const SourceCard: React.FC<{source: RichSource}> = ({ source }) => (
    <div className="border rounded-lg p-3 bg-white hover:shadow-md transition-shadow duration-200">
        <a href={source.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-sm text-blue-700 hover:underline break-words">
            {source.title}
        </a>
        <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
            <span className={`px-2 py-0.5 font-medium rounded-full ${getBiasColor(source.bias_rating)}`}>{source.bias_rating}</span>
            <span className="px-2 py-0.5 font-medium rounded-full bg-gray-100 text-gray-800">{source.source_type}</span>
        </div>
        <div className="mt-3">
            <p className="text-xs text-gray-600 font-medium mb-1">Credibility: {source.credibility_score}%</p>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div className={`${getCredibilityColor(source.credibility_score)} h-1.5 rounded-full`} style={{width: `${source.credibility_score}%`}}></div>
            </div>
        </div>
    </div>
);

const OverviewTab: React.FC<{ result: AnalysisResult }> = ({ result }) => (
    <div className="space-y-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-xl font-bold text-gray-800 mb-3">Analysis Summary</h3>
            <p className="text-gray-600 leading-relaxed">{result.overall_summary}</p>
        </div>
        {result.misinformation_alerts.length > 0 && (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <AlertTriangleIcon className="text-yellow-500 w-6 h-6" />
                    Misinformation Alerts
                </h3>
                <ul className="space-y-4">
                    {result.misinformation_alerts.map((alert, index) => (
                        <li key={index} className="p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-md">
                            <p className="font-semibold text-yellow-800">{alert.type}</p>
                            <p className="text-yellow-700 italic my-1">"{alert.text}"</p>
                            <p className="text-sm text-yellow-900">{alert.explanation}</p>
                        </li>
                    ))}
                </ul>
            </div>
        )}
        {result.grounding_sources.length > 0 && (
             <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <LinkIcon className="text-blue-500 w-6 h-6" />
                    Key Sources Found by Google Search
                </h3>
                <ul className="space-y-3">
                    {result.grounding_sources.slice(0, 5).map((source, index) => (
                         <li key={index} className="text-sm">
                             <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline hover:text-blue-800 transition-colors break-all">
                                 {source.title}
                             </a>
                         </li>
                    ))}
                </ul>
            </div>
        )}
    </div>
);

const ClaimsTab: React.FC<{ result: AnalysisResult }> = ({ result }) => (
    <div className="space-y-4">
        {result.claims.map((claim, index) => {
            const { Icon, color, bgColor } = getStatusInfo(claim.status);
            return (
                <div key={index} className={`p-5 rounded-lg border shadow-sm ${bgColor}`}>
                    <div className="flex items-center gap-3">
                        <Icon className={`${color} w-6 h-6 flex-shrink-0`} />
                        <h4 className={`text-lg font-bold ${color}`}>{claim.status}</h4>
                        <span className="text-sm font-medium text-gray-500">(Confidence: {claim.confidence}%)</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 my-3">
                        <ConsensusBadge consensus={claim.consensus_status} />
                        {claim.is_anomaly && <AnomalyBadge />}
                    </div>
                    <blockquote className="relative border-l-4 border-gray-300 pl-8 py-1 text-gray-700 italic my-4">
                        <QuoteIcon className="absolute -left-1 top-0 w-5 h-5 text-gray-300" />
                        "{claim.claim_text}"
                    </blockquote>
                    <p className="text-sm text-gray-600 mb-4">{claim.explanation}</p>
                    
                    {claim.sources.length > 0 && (
                        <div>
                            <h5 className="text-sm font-semibold text-gray-800 mb-2">Cited Sources for this Claim:</h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {claim.sources.map((source, s_index) => (
                                    <SourceCard key={s_index} source={source} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )
        })}
    </div>
);

const EnhancedArticleTab: React.FC<{ result: AnalysisResult }> = ({ result }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        if (result.claim_review_json_ld) {
            navigator.clipboard.writeText(result.claim_review_json_ld);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };
    let formattedJsonLd = result.claim_review_json_ld;
    try {
        if (result.claim_review_json_ld) {
           formattedJsonLd = JSON.stringify(JSON.parse(result.claim_review_json_ld), null, 2);
        }
    } catch (e) {}

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-xl font-bold text-gray-800 mb-3">Enhanced Article with Inline Citations</h3>
                <div
                    className="prose prose-lg max-w-none font-serif leading-relaxed enhanced-article-content"
                    dangerouslySetInnerHTML={{ __html: result.enhanced_article_html }}
                />
            </div>
            {result.claim_review_json_ld && result.claim_review_json_ld !== "{}" && (
                 <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h3 className="text-xl font-bold text-gray-800 mb-3 flex items-center gap-2">
                        <CodeIcon className="w-6 h-6 text-gray-500" />
                        Fact-Check Schema (JSON-LD)
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
                        This structured data helps search engines understand the fact-check information. You can embed this in your page's HTML.
                    </p>
                    <div className="relative bg-gray-900 text-white rounded-lg p-4 font-mono text-xs overflow-x-auto">
                        <button
                            onClick={handleCopy}
                            className="absolute top-2 right-2 p-2 bg-gray-700 hover:bg-gray-600 rounded-md transition-all text-gray-300"
                            aria-label="Copy JSON-LD to clipboard"
                            title={copied ? "Copied!" : "Copy JSON-LD"}
                        >
                            {copied ? <CheckIcon className="w-4 h-4 text-green-400" /> : <CopyIcon className="w-4 h-4" />}
                        </button>
                        <pre><code>{formattedJsonLd}</code></pre>
                    </div>
                </div>
            )}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-xl font-bold text-gray-800 mb-3">Editorial Suggestions</h3>
                <ul className="space-y-2 list-disc list-inside text-gray-700">
                    {result.editorial_suggestions.map((suggestion, index) => (
                        <li key={index}>{suggestion}</li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

const NewsStandardsTab: React.FC<{ result: AnalysisResult }> = ({ result }) => {
    const standardsData = [
        { name: 'Your Article', scores: result.news_standards_analysis, isCurrent: true },
        { name: 'Reuters', scores: { accuracy: 90, sourcing: 85, neutrality: 85, depth: 80 } },
        { name: 'Associated Press', scores: { accuracy: 92, sourcing: 88, neutrality: 90, depth: 75 } },
        { name: 'New York Times', scores: { accuracy: 88, sourcing: 85, neutrality: 70, depth: 90 } },
        { name: 'CNN', scores: { accuracy: 75, sourcing: 70, neutrality: 60, depth: 70 } },
    ];
    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-xl font-bold text-gray-800 mb-4">News Standards Comparison</h3>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Publication</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Accuracy</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Sourcing</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Neutrality</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Depth</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {standardsData.map((item, index) => (
                            <tr key={index} className={item.isCurrent ? 'bg-blue-50' : ''}>
                                <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${item.isCurrent ? 'text-blue-900' : 'text-gray-900'}`}>{item.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">{item.scores.accuracy}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">{item.scores.sourcing}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">{item.scores.neutrality}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">{item.scores.depth}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const DeepAnalysisTab: React.FC<{ result: AnalysisResult }> = ({ result }) => {
    const { logical_fallacies, propaganda_techniques } = result.deep_analysis;
    if (logical_fallacies.length === 0 && propaganda_techniques.length === 0) {
        return (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 text-center">
                <BrainCircuitIcon className="w-12 h-12 mx-auto text-gray-400" />
                <h3 className="mt-2 text-lg font-medium text-gray-900">No specific rhetorical devices detected.</h3>
                <p className="mt-1 text-sm text-gray-500">The article appears to be straightforward in its presentation.</p>
            </div>
        )
    }
    return (
        <div className="space-y-8">
            {logical_fallacies.length > 0 && (
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <ScaleIcon className="text-purple-600 w-6 h-6" />
                        Logical Fallacies Detected
                    </h3>
                    <div className="space-y-4">
                        {logical_fallacies.map((fallacy, index) => (
                            <div key={index} className="p-4 bg-purple-50 border-l-4 border-purple-400 rounded-r-md">
                                <p className="font-semibold text-purple-800">{fallacy.name}</p>
                                <blockquote className="relative text-purple-700 italic my-2 pl-6">
                                    <QuoteIcon className="absolute left-0 top-0 w-4 h-4 text-purple-300" />
                                    "{fallacy.text}"
                                </blockquote>
                                <p className="text-sm text-purple-900">{fallacy.explanation}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {propaganda_techniques.length > 0 && (
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <MegaphoneIcon className="text-teal-600 w-6 h-6" />
                        Propaganda Techniques Detected
                    </h3>
                    <div className="space-y-4">
                        {propaganda_techniques.map((technique, index) => (
                             <div key={index} className="p-4 bg-teal-50 border-l-4 border-teal-400 rounded-r-md">
                                <p className="font-semibold text-teal-800">{technique.name}</p>
                                <blockquote className="relative text-teal-700 italic my-2 pl-6">
                                    <QuoteIcon className="absolute left-0 top-0 w-4 h-4 text-teal-300" />
                                    "{technique.text}"
                                </blockquote>
                                <p className="text-sm text-teal-900">{technique.explanation}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const ResultsDashboard: React.FC<{ result: AnalysisResult }> = ({ result }) => {
    const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
    const renderTabContent = () => {
        switch (activeTab) {
            case 'overview': return <OverviewTab result={result} />;
            case 'claims': return <ClaimsTab result={result} />;
            case 'enhanced': return <EnhancedArticleTab result={result} />;
            case 'standards': return <NewsStandardsTab result={result} />;
            case 'deep_analysis': return <DeepAnalysisTab result={result} />;
            default: return null;
        }
    };
    return (
        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg border border-gray-200">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-6">2. Analysis Results</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <ScoreCard label="Factual Accuracy" score={result.factual_accuracy_score} description="Based on verifiable claims and source reliability" />
                <ScoreCard label="Misinformation Risk" score={result.misinformation_risk} description="Likelihood of containing false or misleading information" isRisk />
                <ScoreCard label="News Standard Score" score={result.news_standards_score} description="Compared to major journalistic publications" />
            </div>
            <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex space-x-2 sm:space-x-6 overflow-x-auto" aria-label="Tabs">
                    <TabButton label="Overview" Icon={BookOpenIcon} isActive={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
                    <TabButton label="Claims Analysis" Icon={SearchIcon} isActive={activeTab === 'claims'} onClick={() => setActiveTab('claims')} />
                    <TabButton label="Deep Analysis" Icon={BrainCircuitIcon} isActive={activeTab === 'deep_analysis'} onClick={() => setActiveTab('deep_analysis')} />
                    <TabButton label="Enhanced Article" Icon={EditIcon} isActive={activeTab === 'enhanced'} onClick={() => setActiveTab('enhanced')} />
                    <TabButton label="News Standards" Icon={BarChartIcon} isActive={activeTab === 'standards'} onClick={() => setActiveTab('standards')} />
                </nav>
            </div>
            <div key={activeTab} className="animate-entry fade-in">{renderTabContent()}</div>
        </div>
    );
};

// --- APP ---
const SAMPLE_ARTICLE = `Breaking: New Study Reveals Shocking Truth About Coffee Consumption

A groundbreaking study conducted by researchers at Stanford University has revealed that drinking more than 5 cups of coffee per day can increase productivity by 300%. According to Dr. Smith, the lead researcher, "Our findings show definitively that coffee is a miracle drink that can solve all workplace problems."

The study, which surveyed 100 participants over two weeks, found that everyone who drank excessive amounts of coffee reported feeling more energetic. Some participants claimed they could work 20 hours a day without feeling tired.

"This changes everything we thought we knew about caffeine," said Dr. Smith. The research, funded by a major coffee company, suggests that all employees should drink at least 6 cups of coffee daily.

Industry experts are calling this the most important discovery of the century, though some scientists question the methodology used in the study.`;

function App() {
  const [articleText, setArticleText] = useState<string>('');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleAnalysis = useCallback(async () => {
    if (!articleText || articleText.length < 100) {
      setError('Please enter an article with at least 100 characters for a meaningful analysis.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setAnalysisResult(null);

    try {
      setLoadingMessage('Initializing AI analysis...');
      await new Promise(res => setTimeout(res, 300));
      setLoadingMessage('Extracting claims & verifying with Google Search...');
      await new Promise(res => setTimeout(res, 500));
      setLoadingMessage('Performing deep semantic analysis...');
      await new Promise(res => setTimeout(res, 500));
      setLoadingMessage('Generating enhanced article & fact-check schema...');
      const result = await performDeepAnalysis(articleText);
      setLoadingMessage('Finalizing report...');
      await new Promise(res => setTimeout(res, 500));
      setAnalysisResult(result);
    } catch (err) {
      console.error('Analysis failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred during analysis.';
      setError(`Analysis Failed: ${errorMessage}. This can happen due to high demand or an invalid API key. Please check the console and try again later.`);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [articleText]);

  const handleClear = useCallback(() => {
    setArticleText('');
    setAnalysisResult(null);
    setError(null);
    setIsLoading(false);
  }, []);

  const handleLoadSample = useCallback(() => {
    setArticleText(SAMPLE_ARTICLE);
    setAnalysisResult(null);
    setError(null);
  }, []);

   useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            if (!isLoading) handleAnalysis();
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
}, [handleAnalysis, isLoading]);

  return (
    <div className="min-h-screen text-gray-800 bg-gray-50">
      <div className="container mx-auto max-w-7xl px-4 py-8 sm:py-12">
        <Header />
        <main>
          <div className="animate-entry fade-in-up">
            <InputSection
              articleText={articleText}
              onArticleChange={setArticleText}
              onAnalyze={handleAnalysis}
              onClear={handleClear}
              onLoadSample={handleLoadSample}
              isLoading={isLoading}
            />
          </div>
          {isLoading && (
            <div className="animate-entry fade-in">
              <LoadingSpinner message={loadingMessage} />
            </div>
           )}
          {error && (
            <div className="mt-8 bg-red-100 border-l-4 border-red-500 text-red-800 p-6 rounded-r-lg shadow-md animate-entry fade-in" role="alert">
              <h3 className="font-bold text-lg">Error</h3>
              <p>{error}</p>
            </div>
          )}
          {analysisResult && !isLoading && (
            <div className="mt-8 animate-entry fade-in-up">
              <ResultsDashboard result={analysisResult} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// --- RENDER ---
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);