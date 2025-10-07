// src/services/geminiService.ts - Key functions updated for user API keys
import { getApiKeys } from './apiKeyService';

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
 * List available Gemini models
 */
export async function listGeminiModels(): Promise<string[]> {
  const apiKeys = getApiKeys();
  const apiKey = apiKeys.gemini || process.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    console.warn('⚠️ No API key available for listing models');
    return [];
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );

    if (!response.ok) {
      console.error('Failed to fetch models:', response.status);
      return [];
    }

    const data = await response.json();

    if (data && Array.isArray(data.models)) {
      const supportedModels = data.models
        .filter((model: any) =>
          model.supportedGenerationMethods &&
          model.supportedGenerationMethods.includes('generateContent') &&
          !model.name.includes('vision') &&
          !model.name.includes('embedding')
        )
        .map((model: any) => model.name.replace('models/', ''));

      console.log('✅ Found Gemini models:', supportedModels);
      return supportedModels;
    }

    return [];
  } catch (error) {
    console.error('Failed to list Gemini models:', error);
    return [];
  }
}

/**
 * Synthesize evidence using Gemini AI
 */
export async function synthesizeEvidenceWithGemini(
  claimText: string,
  evidence: any[],
  publishingContext: string,
  userApiKey?: string
): Promise<any> {
  const apiKeys = getApiKeys();
  const apiKey = userApiKey || apiKeys.gemini;
  const model = apiKeys.geminiModel || 'gemini-1.5-flash-latest';

  if (!apiKey) {
    throw new Error('Gemini API key is required for synthesis');
  }

  const evidenceSummary = evidence.slice(0, 15).map((e, i) =>
    `${i + 1}. ${e.publisher} (${e.score}%) - "${e.quote?.substring(0, 200) || ''}"`
  ).join('\n');

  const prompt = `You are a professional fact-checker analyzing a claim for ${publishingContext} publication.

CLAIM TO VERIFY:
"${claimText}"

EVIDENCE (${evidence.length} sources):
${evidenceSummary}

Analyze this evidence and provide:
1. VERDICT: One of [TRUE, MOSTLY TRUE, MIXED, MOSTLY FALSE, FALSE, UNVERIFIED]
2. SCORE: 0-100 based on evidence quality and consensus
3. REASONING: 2-3 sentences explaining your verdict
4. WARNINGS: Any concerns about the evidence or claim

Format your response as:
VERDICT: [verdict]
SCORE: [number]
REASONING: [explanation]
WARNINGS: [concerns or "None"]`;

  try {
    const responseText = await generateText(prompt, { apiKey, model });

    // Parse the response
    const verdictMatch = responseText.match(/VERDICT:\s*(.+)/i);
    const scoreMatch = responseText.match(/SCORE:\s*(\d+)/i);
    const reasoningMatch = responseText.match(/REASONING:\s*(.+?)(?=WARNINGS:|$)/is);
    const warningsMatch = responseText.match(/WARNINGS:\s*(.+?)$/is);

    const score = scoreMatch ? parseInt(scoreMatch[1]) :
                  evidence.length > 0 ? Math.round(evidence.reduce((s, e) => s + e.score, 0) / evidence.length) : 0;

    return {
      id: `synthesis_${Date.now()}`,
      originalText: claimText,
      final_verdict: verdictMatch?.[1]?.trim() || generateVerdictFromScore(score),
      final_score: score,
      reasoning: reasoningMatch?.[1]?.trim() || `Based on ${evidence.length} sources.`,
      evidence,
      score_breakdown: {
        final_score_formula: 'AI-powered synthesis of evidence',
        metrics: [
          {
            name: 'Source Reliability',
            score: Math.round(evidence.reduce((s, e) => s + e.score, 0) / evidence.length),
            description: `Average credibility of ${evidence.length} sources`
          },
          {
            name: 'Consensus',
            score: score,
            description: 'Agreement across sources'
          }
        ]
      },
      metadata: {
        method_used: 'gemini-synthesis',
        processing_time_ms: 0,
        apis_used: ['gemini-ai'],
        sources_consulted: {
          total: evidence.length,
          high_credibility: evidence.filter(e => e.score >= 75).length,
          conflicting: 0
        },
        warnings: warningsMatch?.[1]?.trim() !== 'None' ?
          [warningsMatch?.[1]?.trim()].filter(Boolean) : []
      }
    };
  } catch (error) {
    console.error('❌ Gemini synthesis failed:', error);
    throw error;
  }
}

function generateVerdictFromScore(score: number): string {
  if (score >= 85) return 'TRUE';
  if (score >= 70) return 'MOSTLY TRUE';
  if (score >= 50) return 'MIXED';
  if (score >= 30) return 'MOSTLY FALSE';
  return 'FALSE';
}

/**
 * Test Gemini API connection
 */
export async function testGeminiConnection(apiKey: string, model: string = 'gemini-1.5-flash-latest'): Promise<boolean> {
  try {
    await generateText('Hello', { apiKey, model });
    return true;
  } catch (error) {
    console.error('Gemini connection test failed:', error);
    return false;
  }
}