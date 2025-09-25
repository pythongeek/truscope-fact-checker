// src/services/enhancedFactCheckService.ts

import { FactCheckReport } from '@/types/factCheck';
// Make sure to import both the parser and the validator
import { parseAIJsonResponse, validateAIResponseStructure } from '../utils/jsonParser';
import { getGeminiApiKey } from './apiKeyService';
import { GoogleGenAI } from "@google/genai";

export class EnhancedFactCheckService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: getGeminiApiKey() });
  }

  // Kept the original, working callGeminiAPI method
  private async callGeminiAPI(prompt: string): Promise<string> {
    const result = await this.ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    return result.text;
  }

  // Kept the original, working buildFactCheckPrompt method
  private buildFactCheckPrompt(text: string, method: string): string {
    return `
Please analyze the following text for factual accuracy and return a JSON response with the exact structure specified.

Text to analyze: "${text}"

Method: ${method}

IMPORTANT: Your response must be valid JSON only. Do not wrap it in markdown code blocks or add any explanatory text.

Required JSON structure:
{
  "final_verdict": "string (e.g., 'Mostly True', 'False', 'Mixed', etc.)",
  "final_score": number (0-100),
  "reasoning": "string explaining the analysis",
  "score_breakdown": {
    "final_score_formula": "string describing how the score was calculated",
    "metrics": [
      {
        "name": "string",
        "score": number (0-100),
        "description": "string"
      }
    ],
    "confidence_intervals": {
      "lower_bound": number,
      "upper_bound": number
    }
  },
  "evidence": [
    {
      "id": "string",
      "quote": "string",
      "publisher": "string",
      "score": number (0-100),
      "url": "string or null"
    }
  ],
  "metadata": {
    "method_used": "${method}",
    "processing_time_ms": 0,
    "apis_used": ["gemini"],
    "sources_consulted": {
      "total": number,
      "high_credibility": number,
      "conflicting": number
    },
    "warnings": []
  },
  "searchEvidence": {
    "query": "string",
    "results": []
  },
  "originalTextSegments": [],
  "enhanced_claim_text": ""
}

Return only the JSON object, no additional text or formatting.`;
  }

  // Added the new helper method from the user's suggestion
  private parseGeminiResponse(response: string): any {
    try {
      // Use our robust JSON parser instead of direct JSON.parse
      const parsedData = parseAIJsonResponse(response);

      // Validate the structure has required fields for fact-check reports
      const requiredFields = [
        'final_verdict',
        'final_score',
        'score_breakdown',
        'evidence',
        'metadata'
      ];

      if (!validateAIResponseStructure(parsedData, requiredFields)) {
        console.warn('Enhanced fact-check response missing some expected fields, but continuing...');
        // Continue anyway as some fields might be optional
      }

      return parsedData;
    } catch (error) {
      console.error('Failed to parse Gemini response:', error);
      console.error('Raw response (first 500 chars):', response.substring(0, 500));
      throw new Error(`The AI model returned an invalid JSON structure. This may be a temporary issue. Error: ${error.message}`);
    }
  }

  // Added the new default value helper
  private getDefaultScoreBreakdown() {
    return {
      final_score_formula: "weighted average of metrics",
      metrics: [
        { name: 'Source Reliability' as const, score: 50, description: 'Default reliability score' },
        { name: 'Corroboration' as const, score: 50, description: 'Default corroboration score' }
      ]
    };
  }

  // Added the new default value helper
  private getDefaultMetadata(method: string) {
    return {
      method_used: method,
      processing_time_ms: 0,
      apis_used: ['gemini'],
      sources_consulted: {
        total: 0,
        high_credibility: 0,
        conflicting: 0
      },
      warnings: ['Analysis completed with default values due to parsing issues']
    };
  }

  // The new, more robust orchestration method
  async orchestrateFactCheck(text: string, method: string): Promise<FactCheckReport> {
    try {
      console.log(`[Enhanced Fact Check] Starting ${method} analysis for text:`, text.substring(0, 100) + '...');

      const prompt = this.buildFactCheckPrompt(text, method);
      const response = await this.callGeminiAPI(prompt);

      // Replace any direct JSON.parse calls with our robust parser
      const result = this.parseGeminiResponse(response);

      // Ensure we have a valid FactCheckReport structure
      const factCheckReport: FactCheckReport = {
        id: `enhanced-${method}-${Math.random().toString(36).substr(2, 9)}`,
        originalText: text,
        final_verdict: result.final_verdict || 'Unknown',
        final_score: result.final_score || 50,
        score_breakdown: result.score_breakdown || this.getDefaultScoreBreakdown(),
        evidence: result.evidence || [],
        metadata: result.metadata || this.getDefaultMetadata(method),
        searchEvidence: result.searchEvidence,
        originalTextSegments: result.originalTextSegments,
        reasoning: result.reasoning,
        enhanced_claim_text: result.enhanced_claim_text || '',
        correctionAnalysis: result.correctionAnalysis,
        availableCorrections: result.availableCorrections
      };

      console.log(`[Enhanced Fact Check] Completed ${method} analysis with verdict:`, factCheckReport.final_verdict);

      return factCheckReport;
    } catch (error) {
      console.error(`Error during fact-check orchestration with method '${method}':`, error);

      // Provide more specific error messages
      if (error.message && error.message.includes('invalid JSON structure')) {
        throw new Error('The AI model returned an invalid response format. Please try again.');
      } else if (error.message && error.message.includes('Unexpected token')) {
        throw new Error('The AI model response could not be processed. Please try a different analysis method.');
      } else {
        throw new Error(`Analysis failed: ${error.message}`);
      }
    }
  }
}
