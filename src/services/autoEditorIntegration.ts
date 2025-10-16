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
import { EnhancedFactCheckService } from './enhancedFactCheckService';
// CHANGE: We now import our new, secure Vertex AI service.
import { vertexAiService } from './vertexAiService';
import { logger } from '../utils/logger';

export class AutoEditorIntegrationService {
  private static instance: AutoEditorIntegrationService;
  private factCheckService: EnhancedFactCheckService;
  private maxRetries = 3;
  private baseDelay = 1000; // 1 second

  private constructor() {
    this.factCheckService = new EnhancedFactCheckService();
  }

  static getInstance(): AutoEditorIntegrationService {
    if (!AutoEditorIntegrationService.instance) {
      AutoEditorIntegrationService.instance = new AutoEditorIntegrationService();
    }
    return AutoEditorIntegrationService.instance;
  }

  // A simplified and more reliable way to get the model.
  // In the future, this should be passed down from the UI state.
  private getSelectedModel(): string {
    // For now, we rely on the default model set in the vertexAiService and its API route.
    // This removes the unreliable DOM querying.
    return 'gemini-1.5-flash-001';
  }

  // CHANGE: This method is now removed, as we use the vertexAiService.
  // private async callFrontFacingAPI(...) { ... }

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

  // This function now uses the new vertexAiService to check the connection.
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

    // CHANGE: The core of our update. We now call the secure vertexAiService.
    const correctedText = await vertexAiService.generateText(prompt, {
      temperature: mode === 'complete-rewrite' ? 0.7 : 0.3,
      maxOutputTokens: maxTokens,
      model: selectedModel,
    });

    const cleanedText = this.extractCorrectedText(correctedText);
    const changes = this.analyzeChanges(originalText, cleanedText, analysis);

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

  // Fallback rule-based correction (no changes needed here)
  private async performRuleBasedCorrection(
    originalText: string,
    analysis: FactCheckAnalysis,
    mode: EditorMode,
    startTime: number
  ): Promise<EditorResult> {
        logger.info('🔧 Performing rule-based correction as fallback...');
        let correctedText = originalText;
        const changes: ContentChange[] = [];
        // ... (rest of the rule-based logic is unchanged)
        analysis.segments.forEach(segment => {
            if (segment.color === 'red') {
                correctedText = correctedText.replace(segment.text, `${segment.text} [VERIFICATION NEEDED]`);
            }
        });
        return {
            mode: (mode + '-fallback') as EditorMode,
            originalText,
            editedText: correctedText,
            changesApplied: changes,
            improvementScore: (analysis.overallScore + 10), // Simplified
            processingTime: Date.now() - startTime,
            confidence: 70,
        };
  }

  // Main function for generating suggestions in the AutoEditorTab.
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

Your task is to return a valid JSON array of objects, where each object represents a single correction and has the following keys: "originalText", "suggestedText", and "explanation".
- "originalText" MUST be an exact substring from the original text.
- "explanation" should be concise and journalistic.
`;

    try {
      // CHANGE: This now calls our new, secure Vertex AI service.
      const result = await vertexAiService.generateText(prompt);
      
      // Basic cleanup to handle cases where the model wraps the JSON in markdown
      const cleanJson = result.replace(/```json\n?|\n?```/g, '').trim();
      
      const parsedSuggestions: CorrectionSuggestion[] = JSON.parse(cleanJson);
      return parsedSuggestions;
    } catch (error) {
      logger.error("Error generating suggestions with Vertex AI:", error);
      // Return a user-friendly error suggestion instead of an empty array
      return [
        {
          originalText: "AI analysis failed",
          suggestedText: "Could not generate suggestions",
          explanation: "The AI model could not process the request. This might be a temporary issue. Please try again.",
        },
      ];
    }
  }
  
  // All other helper methods (buildCorrectionPrompt, analyzeChanges, etc.) remain the same.
  // Make sure to copy them over from your existing file. I'm omitting them here for brevity.
  
  // NOTE: Ensure these methods are included in your final file
  private calculateOptimalTokens(originalText: string, mode: EditorMode): number { /* ... */ return 2048; }
  private extractCorrectedText(response: string): string { /* ... */ return response; }
  private analyzeChanges(original: string, corrected: string, analysis: FactCheckAnalysis): ContentChange[] { /* ... */ return []; }
  private calculateImprovementScore(analysis: FactCheckAnalysis, changes: ContentChange[]): number { /* ... */ return 0; }
  private calculateConfidence(analysis: FactCheckAnalysis, changes: ContentChange[]): number { /* ... */ return 0; }
  private buildCorrectionPrompt(text: string, analysis: FactCheckAnalysis, mode: EditorMode): string { /* ... */ return ''; }
}

export const autoEditorIntegration = AutoEditorIntegrationService.getInstance();
