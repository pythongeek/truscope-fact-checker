// src/services/autoEditorIntegration.ts
import {
  FactCheckReport,
  TieredFactCheckResult,
  EditorMode,
  CorrectionSuggestion,
} from '@/types';
import {
  EditorResult,
  ContentChange,
  FactCheckSegment,
  FactCheckAnalysis,
} from '@/types/advancedEditor';

export class AutoEditorIntegrationService {
  private static instance: AutoEditorIntegrationService;
  private factCheckService: EnhancedFactCheckService;
  private maxRetries = 3;
  private baseDelay = 1000;

  private constructor() {
    this.factCheckService = new EnhancedFactCheckService();
  }

  static getInstance(): AutoEditorIntegrationService {
    if (!AutoEditorIntegrationService.instance) {
      AutoEditorIntegrationService.instance = new AutoEditorIntegrationService();
    }
    return AutoEditorIntegrationService.instance;
  }

  private getSelectedModel(): string {
    return 'gemini-1.5-flash-001';
  }

  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    operationName: string,
    retries = this.maxRetries
  ): Promise<T> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        logger.info(`🔄 ${operationName} - Attempt ${attempt}/${retries}`);
        return await operation();
      } catch (error: any) {
        const isRetryableError = this.isRetryableError(error);
        const isLastAttempt = attempt === retries;

        logger.warn(`❌ ${operationName} failed on attempt ${attempt}:`, error.message);

        if (isLastAttempt || !isRetryableError) {
          throw error;
        }

        const delay = this.baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
        logger.info(`⏳ Waiting ${Math.round(delay)}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error(`${operationName} failed after ${retries} attempts`);
  }

  private isRetryableError(error: any): boolean {
    const retryableErrors = [
      '503', '502', '500', '429', '408',
      'ECONNRESET', 'ENOTFOUND', 'TIMEOUT',
      'network error', 'fetch error', 'failed to generate'
    ];
    const errorString = error.toString().toLowerCase();
    return retryableErrors.some(code => errorString.includes(code.toLowerCase()));
  }

  async checkAPIHealth(): Promise<{ available: boolean; message: string; model: string }> {
    const model = this.getSelectedModel();
    try {
      await vertexAiService.generateText('Test connection', {
          maxOutputTokens: 10,
          temperature: 0.1,
          model,
      });
      return { available: true, message: `API is available using ${model}`, model };
    } catch (error: any) {
      return { available: false, message: `API Error: ${error.message}`, model };
    }
  }

  async performAutoCorrection(
    originalText: string,
    analysis: FactCheckAnalysis,
    mode: EditorMode = 'enhanced'
  ): Promise<EditorResult> {
    logger.info('🤖 Starting auto-correction with mode:', mode);
    const startTime = Date.now();
    try {
      return await this.retryWithBackoff(
        () => this.performAICorrection(originalText, analysis, mode, startTime),
        'AI Auto-correction'
      );
    } catch (error: any) {
      logger.warn('🔄 AI correction failed, falling back to rule-based correction:', error.message);
      return this.performRuleBasedCorrection(originalText, analysis, mode, startTime);
    }
  }

  private async performAICorrection(
    originalText: string,
    analysis: FactCheckAnalysis,
    mode: EditorMode,
    startTime: number
  ): Promise<EditorResult> {
    const prompt = this.buildCorrectionPrompt(originalText, analysis, mode);
    const selectedModel = this.getSelectedModel();
    const maxTokens = this.calculateOptimalTokens(originalText, mode);

    logger.info(`📝 Processing with ${selectedModel}, estimated ${maxTokens} max tokens`);

    const correctedText = await vertexAiService.generateText(prompt, {
      temperature: mode === 'complete-rewrite' ? 0.7 : 0.3,
      maxOutputTokens: maxTokens,
      model: selectedModel,
    });

    const cleanedText = this.extractCorrectedText(correctedText);
    const changes = this.analyzeChanges(originalText, cleanedText, analysis);
    this.logTokenUsage(originalText, cleanedText, selectedModel);

    return {
      mode,
      originalText,
      editedText: cleanedText,
      changesApplied: changes,
      improvementScore: this.calculateImprovementScore(analysis, changes),
      processingTime: Date.now() - startTime,
      confidence: this.calculateConfidence(analysis, changes),
    };
  }
    
  private calculateOptimalTokens(originalText: string, mode: EditorMode): number {
    const baseTokens = Math.ceil(originalText.length / 3);
    const modeMultipliers: Record<EditorMode, number> = {
      'quick-fix': 1.2,
      'enhanced': 1.5,
      'complete-rewrite': 2.0,
      'seo-optimized': 1.8,
      'academic': 1.7,
      'expansion': 2.5,
    };
    const multiplier = modeMultipliers[mode] || 1.5;
    const estimatedOutputTokens = Math.ceil(baseTokens * multiplier);
    const maxTokens = Math.min(estimatedOutputTokens, 8192);
    logger.info(`💰 Token estimate - Input: ~${baseTokens}, Output: ~${estimatedOutputTokens}, Max: ${maxTokens}`);
    return maxTokens;
  }

  private logTokenUsage(originalText: string, correctedText: string, model: string): void {
    const inputTokens = Math.ceil(originalText.length / 3);
    const outputTokens = Math.ceil(correctedText.length / 3);
    logger.info(`📊 Token Usage Summary: Model: ${model}, Input: ~${inputTokens}, Output: ~${outputTokens}`);
  }

  private async performRuleBasedCorrection(
    originalText: string,
    analysis: FactCheckAnalysis,
    mode: EditorMode,
    startTime: number
  ): Promise<EditorResult> {
    logger.info('🔧 Performing rule-based correction as fallback...');
    let correctedText = originalText;
    const changes: ContentChange[] = [];

    analysis.segments.forEach((segment) => {
      if (segment.color === 'red') {
        const disclaimer = ' [⚠️ This claim requires verification]';
        if (!correctedText.includes(disclaimer)) {
          correctedText = correctedText.replace(segment.text, segment.text + disclaimer);
          changes.push({ type: 'addition', originalPhrase: segment.text, newPhrase: segment.text + disclaimer, reason: 'Added verification disclaimer.', confidence: 0.7, position: { start: segment.startIndex, end: segment.endIndex } });
        }
      }
    });

    return {
      mode: (mode + '-fallback') as EditorMode,
      originalText,
      editedText: correctedText,
      changesApplied: changes,
      improvementScore: Math.min(analysis.overallScore + 15, 85),
      processingTime: Date.now() - startTime,
      confidence: 70
    };
  }

  private buildCorrectionPrompt(text: string, analysis: FactCheckAnalysis, mode: EditorMode): string {
    const modeInstructions: Record<EditorMode, string> = {
      'quick-fix': 'Make minimal changes to fix only the most critical factual errors while preserving the original style.',
      'enhanced': 'Fix factual errors, add context where needed, improve clarity, and enhance readability.',
      'complete-rewrite': 'Completely rewrite the content to be factually accurate, well-structured, and engaging.',
      'seo-optimized': 'Rewrite for SEO optimization with proper headings and keywords, ensuring factual accuracy.',
      'academic': 'Transform into formal academic writing with proper citations.',
      'expansion': 'Expand the content significantly with additional context and examples.'
    };

    return `You are a professional content editor. Correct the following text based on the provided fact-check analysis.

ORIGINAL TEXT:
${text}

FACT-CHECK ANALYSIS:
- Overall Score: ${analysis.overallScore}/100
- Verdict: ${analysis.verdict}
- Segments needing attention:
${analysis.segments.filter(s => s.score < 75).map(s => `- ${s.color.toUpperCase()}: "${s.text.substring(0, 100)}..."`).join('\n')}

EDITOR MODE: ${mode}
INSTRUCTIONS: ${modeInstructions[mode]}

Provide ONLY the corrected text. Do not include explanations or comments.`;
  }

  private extractCorrectedText(response: string): string {
    let cleaned = response.trim();
    cleaned = cleaned.replace(/```[\s\S]*?```/g, '');
    const prefixes = ['Corrected text:', 'Here is the corrected text:', 'Here\'s the improved version:'];
    for (const prefix of prefixes) {
      if (cleaned.toLowerCase().startsWith(prefix.toLowerCase())) {
        cleaned = cleaned.substring(prefix.length).trim();
      }
    }
    return cleaned;
  }

  private analyzeChanges(original: string, corrected: string, analysis: FactCheckAnalysis): ContentChange[] {
    const changes: ContentChange[] = [];
    if (original === corrected) return changes;

    analysis.segments.forEach((segment) => {
      if ((segment.color === 'red' || segment.color === 'orange') && !corrected.includes(segment.text)) {
        changes.push({
          type: 'modification',
          originalPhrase: segment.text.substring(0, 100),
          newPhrase: 'Fact-checked and corrected version',
          reason: `${segment.color.toUpperCase()} segment was corrected for accuracy.`,
          confidence: segment.score / 100,
          position: { start: segment.startIndex, end: segment.endIndex }
        });
      }
    });
    return changes;
  }

  private calculateImprovementScore(analysis: FactCheckAnalysis, changes: ContentChange[]): number {
    const baseScore = analysis.overallScore;
    const changeBonus = Math.min(30, changes.length * 5);
    return Math.min(95, baseScore + changeBonus);
  }

  private calculateConfidence(analysis: FactCheckAnalysis, changes: ContentChange[]): number {
    if (changes.length === 0) return 95;
    const avgChangeConfidence = changes.reduce((sum, c) => sum + c.confidence, 0) / changes.length;
    return Math.round(avgChangeConfidence * 100);
  }

  async generateSuggestions(
    factCheckResult: TieredFactCheckResult
  ): Promise<CorrectionSuggestion[]> {
    if (!factCheckResult.claimVerifications || factCheckResult.claimVerifications.length === 0) {
      return [];
    }
    const inaccurateClaims = factCheckResult.claimVerifications.filter(
      (v) => v.status === 'Unverified' || v.status === 'Disputed'
    );
    if (inaccurateClaims.length === 0) {
      return [];
    }

    const prompt = `Analyze the original text and the following list of identified inaccurate claims. For each inaccurate claim, generate a correction suggestion.

Original Text:
"""
${factCheckResult.originalText}
"""

Inaccurate Claims:
${inaccurateClaims.map(c => `- Claim: "${c.claimText}" (Reason: ${c.explanation})`).join('\n')}

Your task is to return a valid JSON array of objects. Each object represents a single correction and MUST have the following keys: "id", "originalText", "suggestedText", and "explanation".
- "id" should be a unique string for each suggestion (e.g., "suggestion-1").
- "originalText" MUST be an exact substring from the original text.
- "explanation" should be concise and journalistic.
`;

    try {
      const result = await vertexAiService.generateText(prompt);
      const cleanJson = result.replace(/```json\n?|\n?```/g, '').trim();
      const parsedSuggestions: CorrectionSuggestion[] = JSON.parse(cleanJson);
      return parsedSuggestions;
    } catch (error) {
      logger.error("Error generating suggestions with Vertex AI:", error);
      return [
        {
          id: "ai-error-fallback",
          originalText: "AI analysis failed",
          suggestedText: "Could not generate suggestions",
          explanation: "The AI model could not process the request. Please try again.",
        },
      ];
    }
  }
}

export const autoEditorIntegration = AutoEditorIntegrationService.getInstance();
