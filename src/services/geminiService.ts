// src/services/geminiService.ts - Key functions updated for user API keys
import { getApiKeys } from './apiKeyService';
import { FactCheckReport, FactCheckMethod } from '@/types/factCheck';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

interface GeminiConfig {
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

/**
 * Generate text using Gemini API with user-provided or environment API key
 * @param prompt The prompt to send to Gemini
 * @param config Configuration including optional user API key
 */
export async function generateText(
  prompt: string,
  config: GeminiConfig = {}
): Promise<string> {
  // Priority: 1. Passed API key, 2. User's stored key, 3. Environment key
  const apiKeys = getApiKeys();
  const apiKey = config.apiKey || apiKeys.gemini || process.env.VITE_GEMINI_API_KEY;
  const model = config.model || apiKeys.geminiModel || 'gemini-1.5-flash-latest';

  if (!apiKey || apiKey.trim() === '') {
    throw new Error(
      'Gemini API key is required. Please configure your API key in Settings.'
    );
  }

  const fullApiUrl = `${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`;

  console.log(`🤖 Calling Gemini API (model: ${model})`);

  try {
    const response = await fetch(fullApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt,
          }],
        }],
        generationConfig: {
          temperature: config.temperature || 0.3,
          maxOutputTokens: config.maxOutputTokens || 2000,
        }
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json();
      console.error('[Gemini Error] API response:', errorBody);

      // Provide helpful error messages
      if (response.status === 400) {
        throw new Error(
          `Invalid API request: ${errorBody.error?.message || 'Bad request'}. ` +
          'Please check your API key and model selection.'
        );
      } else if (response.status === 403) {
        throw new Error(
          'API key invalid or access denied. Please check your Gemini API key in Settings.'
        );
      } else if (response.status === 429) {
        throw new Error(
          'Rate limit exceeded. Please try again in a few moments.'
        );
      }

      throw new Error(
        `Gemini API request failed (${response.status}): ${errorBody.error?.message || 'Unknown error'}`
      );
    }

    const data = await response.json();

    if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content) {
      console.warn('[Gemini Warning] No content in response:', data);
      throw new Error('No content received from Gemini API. The model may have blocked the response.');
    }

    const text = data.candidates[0].content.parts[0].text;
    console.log('✅ Gemini API call successful');

    return text;

  } catch (error) {
    console.error('[Gemini Fatal Error] Failed to call Gemini API:', error);

    // Re-throw with context
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Gemini API call failed: ${String(error)}`);
  }
}

/**
 * Main orchestrator for fact-checking that routes to appropriate services
 * This is a wrapper that can be used by batch processing and other services
 */
export async function runFactCheckOrchestrator(
  claimText: string,
  method: FactCheckMethod = 'comprehensive'
): Promise<FactCheckReport> {
  const apiKeys = getApiKeys();

  // Call the main fact-check API endpoint
  const response = await fetch('/api/fact-check', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: claimText,
      publishingContext: 'journalism',
      config: {
        gemini: apiKeys.gemini,
        geminiModel: apiKeys.geminiModel || 'gemini-1.5-flash-latest',
        factCheck: apiKeys.factCheck,
        search: apiKeys.search,
        searchId: apiKeys.searchId,
      },
      method: method
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || errorData.details || 'Fact-check failed');
  }

  const result = await response.json();
  return result as FactCheckReport;
}

/**
 * List available Gemini models
 */
export async function listGeminiModels(): Promise<string[]> {
  const apiKeys = getApiKeys();

  if (!apiKeys.gemini) {
    console.warn('No Gemini API key configured');
    return [];
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKeys.gemini}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch models');
    }

    const data = await response.json();

    if (data.models && Array.isArray(data.models)) {
      return data.models
        .filter((model: any) => model.name && model.name.includes('gemini'))
        .map((model: any) => model.name.replace('models/', ''))
        .sort();
    }

    return [];
  } catch (error) {
    console.error('Error fetching Gemini models:', error);
    return [];
  }
}

/**
 * Test Gemini API connection
 */
export async function testGeminiConnection(apiKey?: string): Promise<boolean> {
  const key = apiKey || getApiKeys().gemini;

  if (!key) {
    return false;
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: 'Test' }]
          }]
        })
      }
    );

    return response.ok;
  } catch (error) {
    console.error('Gemini connection test failed:', error);
    return false;
  }
}

/**
 * Generate content using Gemini
 */
export async function generateGeminiContent(
  prompt: string,
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }
): Promise<string> {
  const apiKeys = getApiKeys();

  if (!apiKeys.gemini) {
    throw new Error('Gemini API key not configured');
  }

  const model = options?.model || apiKeys.geminiModel || 'gemini-1.5-flash-latest';
  const temperature = options?.temperature ?? 0.7;
  const maxTokens = options?.maxTokens ?? 2048;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKeys.gemini}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature,
            maxOutputTokens: maxTokens,
          }
        })
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Gemini API request failed');
    }

    const data = await response.json();

    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
      return data.candidates[0].content.parts[0].text;
    }

    throw new Error('Invalid response format from Gemini API');
  } catch (error) {
    console.error('Gemini content generation failed:', error);
    throw error;
  }
}
/**
 * Synthesizes evidence using the Gemini API to generate a fact-check report.
 * @param originalClaim The original text of the claim being checked.
 * @param evidence An array of evidence items.
 * @param publishingContext The context in which the claim is being published.
 * @returns A promise that resolves to a FactCheckReport.
 */
export async function synthesizeEvidenceWithGemini(
  originalClaim: string,
  evidence: any[],
  publishingContext: string
): Promise<FactCheckReport> {
  const evidenceSummary = evidence
    .slice(0, 15) // Limit evidence to avoid exceeding token limits
    .map((e, i) => `[Source ${i + 1} - ${e.publisher} - Credibility: ${e.score}%]: "${e.quote}"`)
    .join('\n');

  const prompt = `
    As an expert fact-checker, your task is to analyze the following claim based on the provided evidence.
    Your analysis must be objective, impartial, and strictly based on the sources.

    **Claim:** "${originalClaim}"

    **Publishing Context:** ${publishingContext}

    **Evidence:**
    ${evidenceSummary}

    **Your Task:**
    Provide a final verdict and a numerical score (0-100).
    Explain your reasoning clearly and concisely.
    The output MUST be a valid JSON object in the following format, with no additional text or explanations before or after the JSON block.

    {
      "final_verdict": "...",
      "final_score": ...,
      "reasoning": "...",
      "score_breakdown": {
        "final_score_formula": "Weighted analysis of source credibility and corroboration.",
        "metrics": [
          {
            "name": "Source Reliability",
            "score": ...,
            "description": "Average credibility of provided sources."
          },
          {
            "name": "Corroboration",
            "score": ...,
            "description": "Degree to which sources confirm each other."
          }
        ]
      }
    }
  `;

  try {
    const jsonString = await generateText(prompt, { maxOutputTokens: 1500 });
    // Clean the response to ensure it's valid JSON
    const cleanedJson = jsonString.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleanedJson);

    // Basic validation of the parsed object
    if (!result.final_verdict || typeof result.final_score !== 'number') {
      throw new Error('Invalid JSON structure from Gemini');
    }

    // Return a partial FactCheckReport - other services will fill the rest
    return result as Partial<FactCheckReport> as FactCheckReport;
  } catch (error) {
    console.error('Error during Gemini synthesis:', error);
    throw new Error(`Failed to synthesize evidence with Gemini: ${error instanceof Error ? error.message : String(error)}`);
  }
}