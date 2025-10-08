// src/services/geminiService.ts - Updated with Gemini AI Studio API
import { getApiKeys } from './apiKeyService';
import { FactCheckReport, FactCheckMethod } from '@/types/factCheck';

// ✅ CORRECT: Gemini AI Studio API URL
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

interface GeminiConfig {
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

/**
 * Generate text using Gemini AI Studio API
 * @param prompt The prompt to send to Gemini
 * @param config Configuration including optional user API key
 */
export async function generateText(
  prompt: string,
  config: GeminiConfig = {}
): Promise<string> {
  const apiKeys = getApiKeys();
  const apiKey = config.apiKey || apiKeys.gemini;
  const model = config.model || apiKeys.geminiModel || 'gemini-1.5-flash-latest';

  if (!apiKey || apiKey.trim() === '') {
    throw new Error(
      'Gemini API key is required. Please configure your API key in Settings.'
    );
  }

  // ✅ CORRECT: AI Studio API endpoint format
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

    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Gemini API call failed: ${String(error)}`);
  }
}

/**
 * Main orchestrator for fact-checking that routes to API endpoint
 */
export async function runFactCheckOrchestrator(
  claimText: string,
  method: FactCheckMethod = 'comprehensive'
): Promise<FactCheckReport> {
  const apiKeys = getApiKeys();

  // Call the main fact-check API endpoint with user API keys
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
 * List available Gemini models from AI Studio
 */
export async function listGeminiModels(): Promise<string[]> {
  const apiKeys = getApiKeys();

  if (!apiKeys.gemini) {
    console.warn('No Gemini API key configured');
    return getDefaultGeminiModels();
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKeys.gemini}`
    );

    if (!response.ok) {
      console.warn('Failed to fetch models, using defaults');
      return getDefaultGeminiModels();
    }

    const data = await response.json();

    if (data.models && Array.isArray(data.models)) {
      return data.models
        .filter((model: any) => {
          const name = model.name?.replace('models/', '') || '';
          return name.includes('gemini') && model.supportedGenerationMethods?.includes('generateContent');
        })
        .map((model: any) => model.name.replace('models/', ''))
        .sort();
    }

    return getDefaultGeminiModels();
  } catch (error) {
    console.error('Error fetching Gemini models:', error);
    return getDefaultGeminiModels();
  }
}

/**
 * Default Gemini models available in AI Studio
 */
function getDefaultGeminiModels(): string[] {
  return [
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash',
    'gemini-1.5-pro-latest',
    'gemini-1.5-pro',
    'gemini-1.0-pro-latest',
    'gemini-1.0-pro',
    'gemini-2.0-flash-exp'
  ];
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
      `${GEMINI_API_URL}/gemini-1.5-flash-latest:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: 'Test connection' }]
          }],
          generationConfig: {
            maxOutputTokens: 10
          }
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
      `${GEMINI_API_URL}/${model}:generateContent?key=${apiKeys.gemini}`,
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
 */
export async function synthesizeEvidenceWithGemini(
  originalClaim: string,
  evidence: any[],
  publishingContext: string
): Promise<FactCheckReport> {
  const evidenceSummary = evidence
    .slice(0, 15)
    .map((e, i) => `[Source ${i + 1} - ${e.publisher} - Credibility: ${e.score}%]: "${e.quote}"`)
    .join('\n');

  const prompt = `
As an expert fact-checker, analyze the following claim based on the provided evidence.
Your analysis must be objective, impartial, and strictly based on the sources.

**Claim:** "${originalClaim}"

**Publishing Context:** ${publishingContext}

**Evidence:**
${evidenceSummary}

**Your Task:**
Provide a final verdict and a numerical score (0-100).
Explain your reasoning clearly and concisely.
Output MUST be valid JSON in this exact format:

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
    const cleanedJson = jsonString.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleanedJson);

    if (!result.final_verdict || typeof result.final_score !== 'number') {
      throw new Error('Invalid JSON structure from Gemini');
    }

    return result as Partial<FactCheckReport> as FactCheckReport;
  } catch (error) {
    console.error('Error during Gemini synthesis:', error);
    throw new Error(`Failed to synthesize evidence with Gemini: ${error instanceof Error ? error.message : String(error)}`);
  }
}
