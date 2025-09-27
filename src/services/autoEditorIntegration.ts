// Enhanced autoEditorIntegration.ts using front-facing API
import { FactCheckReport } from '../types/factCheck';
import { EditorMode, EditorResult, ContentChange, FactCheckSegment, FactCheckAnalysis } from '../types/advancedEditor';
import { runFactCheckOrchestrator } from './geminiService';

export class AutoEditorIntegrationService {
  private static instance: AutoEditorIntegrationService;
  private maxRetries = 3;
  private baseDelay = 1000; // 1 second

  constructor() {
    // No direct API key needed - using front-facing API
  }

  static getInstance(): AutoEditorIntegrationService {
    if (!AutoEditorIntegrationService.instance) {
      AutoEditorIntegrationService.instance = new AutoEditorIntegrationService();
    }
    return AutoEditorIntegrationService.instance;
  }

  // Get selected model from UI state
  private getSelectedModel(): string {
    // Try to get from localStorage/sessionStorage first
    try {
      const savedModel = localStorage.getItem('truescope-selected-model') ||
                        sessionStorage.getItem('truescope-selected-model');
      if (savedModel) {
        return savedModel;
      }
    } catch (error) {
      console.warn('Could not access storage for model selection');
    }

    // Try to get from DOM elements (if model selector is visible)
    const modelSelector = document.querySelector('[data-model-selector]') as HTMLSelectElement;
    if (modelSelector && modelSelector.value) {
      return modelSelector.value;
    }

    // Try to detect from current fact-check results
    const currentResults = document.querySelector('[data-current-model]');
    if (currentResults) {
      const model = currentResults.getAttribute('data-current-model');
      if (model) return model;
    }

    // Default fallback - use the most reliable model
    return 'gemini-2.0-flash-exp';
  }

  // Use front-facing API for all AI operations
  private async callFrontFacingAPI(prompt: string, options: {
    temperature?: number;
    maxTokens?: number;
    model?: string;
  } = {}): Promise<string> {
    const selectedModel = options.model || this.getSelectedModel();

    const requestBody = {
      prompt: prompt,
      model: selectedModel,
      temperature: options.temperature || 0.3,
      max_tokens: options.maxTokens || 4096,
      // Add auto-correction specific parameters
      system_message: "You are a professional content editor and fact-checker. Provide only the corrected text without explanations.",
      use_case: "auto_correction"
    };

    console.log(`🤖 Using model: ${selectedModel} for auto-correction`);

    const response = await fetch('/api/gemini-service', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorData.error || 'Unknown error'}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    return data.response || data.text || data.content || '';
  }

  // Add retry mechanism with exponential backoff
  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    operationName: string,
    retries = this.maxRetries
  ): Promise<T> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`🔄 ${operationName} - Attempt ${attempt}/${retries}`);
        return await operation();
      } catch (error: any) {
        const isRetryableError = this.isRetryableError(error);
        const isLastAttempt = attempt === retries;

        console.warn(`❌ ${operationName} failed on attempt ${attempt}:`, error.message);

        if (isLastAttempt || !isRetryableError) {
          throw error;
        }

        // Exponential backoff with jitter
        const delay = this.baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
        console.log(`⏳ Waiting ${Math.round(delay)}ms before retry...`);
        await this.delay(delay);
      }
    }
    throw new Error(`${operationName} failed after ${retries} attempts`);
  }

  private isRetryableError(error: any): boolean {
    const retryableErrors = [
      '503', // Service Unavailable
      '502', // Bad Gateway
      '500', // Internal Server Error
      '429', // Too Many Requests
      '408', // Request Timeout
      'ECONNRESET',
      'ENOTFOUND',
      'TIMEOUT',
      'network error',
      'fetch error'
    ];

    const errorString = error.toString().toLowerCase();
    return retryableErrors.some(code => errorString.includes(code.toLowerCase()));
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Check API health using front-facing endpoint
  async checkAPIHealth(): Promise<{ available: boolean; message: string; model: string }> {
    try {
      const selectedModel = this.getSelectedModel();

      // Make a simple test request to check if API is working
      const testResponse = await fetch('/api/gemini-service', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: 'Test connection',
          model: selectedModel,
          max_tokens: 10,
          temperature: 0.1
        })
      });

      if (testResponse.ok) {
        return {
          available: true,
          message: `API is available using ${selectedModel}`,
          model: selectedModel
        };
      } else {
        const errorData = await testResponse.json().catch(() => ({}));
        return {
          available: false,
          message: `API Error (${testResponse.status}): ${errorData.error || 'Unknown error'}`,
          model: selectedModel
        };
      }
    } catch (error: any) {
      return {
        available: false,
        message: `Connection Error: ${error.message}`,
        model: this.getSelectedModel()
      };
    }
  }

  // Enhanced performAutoCorrection with front-facing API
  async performAutoCorrection(
    originalText: string,
    analysis: FactCheckAnalysis,
    mode: EditorMode = 'enhanced'
  ): Promise<EditorResult> {
    console.log('🤖 Starting auto-correction with mode:', mode);
    const startTime = Date.now();

    try {
      // Try the AI-powered correction first
      return await this.retryWithBackoff(
        () => this.performAICorrection(originalText, analysis, mode, startTime),
        'AI Auto-correction'
      );
    } catch (error: any) {
      console.warn('🔄 AI correction failed, falling back to rule-based correction:', error.message);

      // Fallback to rule-based correction
      return await this.performRuleBasedCorrection(originalText, analysis, mode, startTime);
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

    // Optimize token usage based on content length and mode
    const maxTokens = this.calculateOptimalTokens(originalText, mode);

    console.log(`📝 Processing with ${selectedModel}, estimated ${maxTokens} max tokens`);

    const correctedText = await this.callFrontFacingAPI(prompt, {
      temperature: mode === 'complete-rewrite' ? 0.7 : 0.3,
      maxTokens: maxTokens,
      model: selectedModel
    });

    const cleanedText = this.extractCorrectedText(correctedText);
    const changes = this.analyzeChanges(originalText, cleanedText, analysis);

    const result: EditorResult = {
      mode,
      originalText,
      editedText: cleanedText,
      changesApplied: changes,
      improvementScore: this.calculateImprovementScore(analysis, changes),
      processingTime: Date.now() - startTime,
      confidence: this.calculateConfidence(analysis, changes)
    };

    // Save tokens usage info
    this.logTokenUsage(originalText, cleanedText, selectedModel);

    return result;
  }

  // Calculate optimal token usage to be economical
  private calculateOptimalTokens(originalText: string, mode: EditorMode): number {
    const baseTokens = Math.ceil(originalText.length / 3); // Rough estimate: 1 token ≈ 3 chars
    const inputTokens = baseTokens;

    const modeMultipliers = {
      'quick-fix': 1.2,      // Minimal changes
      'enhanced': 1.5,       // Moderate expansion
      'complete-rewrite': 2.0, // Full rewrite
      'seo-optimized': 1.8,  // SEO additions
      'academic': 1.7,       // Formal expansion
      'expansion': 2.5       // Significant expansion
    };

    const multiplier = modeMultipliers[mode] || 1.5;
    const estimatedOutputTokens = Math.ceil(inputTokens * multiplier);

    // Cap at reasonable limits to control costs
    const maxTokens = Math.min(estimatedOutputTokens, 4096);

    console.log(`💰 Token estimate - Input: ~${inputTokens}, Output: ~${estimatedOutputTokens}, Max: ${maxTokens}`);

    return maxTokens;
  }

  private logTokenUsage(originalText: string, correctedText: string, model: string): void {
    const inputTokens = Math.ceil(originalText.length / 3);
    const outputTokens = Math.ceil(correctedText.length / 3);
    const totalTokens = inputTokens + outputTokens;

    console.log(`📊 Token Usage Summary:
      Model: ${model}
      Input tokens: ~${inputTokens}
      Output tokens: ~${outputTokens}
      Total tokens: ~${totalTokens}
      Efficiency: ${Math.round((outputTokens / inputTokens) * 100)}% expansion
    `);

    // Store usage stats for monitoring
    try {
      const usageStats = JSON.parse(localStorage.getItem('truescope-token-usage') || '[]');
      usageStats.push({
        timestamp: new Date().toISOString(),
        model,
        inputTokens,
        outputTokens,
        totalTokens,
        feature: 'auto-correction'
      });

      // Keep only last 100 entries to avoid storage bloat
      if (usageStats.length > 100) {
        usageStats.splice(0, usageStats.length - 100);
      }

      localStorage.setItem('truescope-token-usage', JSON.stringify(usageStats));
    } catch (error) {
      console.warn('Could not save token usage stats:', error);
    }
  }

  // Fallback rule-based correction when AI is unavailable
  private async performRuleBasedCorrection(
    originalText: string,
    analysis: FactCheckAnalysis,
    mode: EditorMode,
    startTime: number
  ): Promise<EditorResult> {
    console.log('🔧 Performing rule-based correction as fallback...');

    let correctedText = originalText;
    const changes: ContentChange[] = [];

    // Apply corrections based on analysis segments
    for (const segment of analysis.segments) {
      if (segment.color === 'red') {
        // For red segments, add disclaimers
        const disclaimer = ' [⚠️ This claim needs verification - please check reliable sources]';
        if (!correctedText.includes(disclaimer)) {
          correctedText = correctedText.replace(segment.text, segment.text + disclaimer);
          changes.push({
            type: 'addition',
            originalPhrase: segment.text.substring(0, 50) + '...',
            newPhrase: segment.text.substring(0, 50) + '...' + disclaimer,
            reason: 'Added verification disclaimer for potentially false information',
            confidence: 0.7,
            position: { start: segment.startIndex, end: segment.endIndex }
          });
        }
      } else if (segment.color === 'orange') {
        // For orange segments, add context note
        const contextNote = ' [ℹ️ Additional context may be needed]';
        if (!correctedText.includes(contextNote)) {
          correctedText = correctedText.replace(segment.text, segment.text + contextNote);
          changes.push({
            type: 'modification',
            originalPhrase: segment.text.substring(0, 50) + '...',
            newPhrase: segment.text.substring(0, 50) + '...' + contextNote,
            reason: 'Added context note for partially accurate information',
            confidence: 0.6,
            position: { start: segment.startIndex, end: segment.endIndex }
          });
        }
      }
    }

    // Add corrections from evidence
    analysis.corrections.forEach((correction, index) => {
      const evidenceNote = `\n\n📚 Additional Information ${index + 1}: ${correction.corrected}`;
      if (!correctedText.includes(evidenceNote)) {
        correctedText += evidenceNote;
        changes.push({
          type: 'addition',
          originalPhrase: 'End of content',
          newPhrase: evidenceNote.trim(),
          reason: correction.reason,
          confidence: correction.confidence / 100,
          position: { start: originalText.length, end: originalText.length }
        });
      }
    });

    // If no changes were made, add a general disclaimer
    if (changes.length === 0 && analysis.overallScore < 50) {
      const generalDisclaimer = '\n\n⚠️ **Fact-Check Notice**: This content contains claims that may require verification. Please check information against reliable sources.';
      correctedText += generalDisclaimer;
      changes.push({
        type: 'addition',
        originalPhrase: 'End of content',
        newPhrase: generalDisclaimer.trim(),
        reason: 'Added general fact-checking disclaimer due to low accuracy score',
        confidence: 0.8,
        position: { start: originalText.length, end: originalText.length }
      });
    }

    return {
      mode: (mode + '-fallback') as EditorMode,
      originalText,
      editedText: correctedText,
      changesApplied: changes,
      improvementScore: Math.min(analysis.overallScore + 15, 85), // Modest improvement
      processingTime: Date.now() - startTime,
      confidence: 70 // Lower confidence for rule-based corrections
    };
  }

  // Rest of the existing methods...
  async performFactCheckAnalysis(text: string): Promise<FactCheckAnalysis> {
    console.log('🔍 Starting comprehensive fact-check analysis...');

    try {
      const factCheckReport = await runFactCheckOrchestrator(text, 'citation-augmented');
      const segments = this.convertToColorCodedSegments(text, factCheckReport);
      const corrections = this.extractCorrections(factCheckReport);

      const analysis: FactCheckAnalysis = {
        segments,
        overallScore: factCheckReport.final_score,
        verdict: factCheckReport.final_verdict,
        timestamp: new Date().toISOString(),
        corrections,
        originalReport: factCheckReport
      };

      this.saveAnalysisToStorage(text, analysis);
      console.log('✅ Fact-check analysis completed with', segments.length, 'segments');
      return analysis;

    } catch (error: any) {
      console.error('❌ Fact-check analysis failed:', error);
      throw new Error(`Fact-check analysis failed: ${error.message}`);
    }
  }

  private convertToColorCodedSegments(text: string, report: FactCheckReport): FactCheckSegment[] {
    const segments: FactCheckSegment[] = [];

    if (report.originalTextSegments && report.originalTextSegments.length > 0) {
      let currentIndex = 0;
      report.originalTextSegments.forEach((segment) => {
        const segmentLength = Math.floor(segment.text.length);
        const color = this.scoreToColor(segment.score);

        segments.push({
          text: segment.text,
          score: segment.score,
          color,
          startIndex: currentIndex,
          endIndex: currentIndex + segmentLength,
          reason: this.getReasonForScore(segment.score, color)
        });

        currentIndex += segmentLength;
      });
    } else {
      const overallColor = this.scoreToColor(report.final_score);
      segments.push({
        text: text,
        score: report.final_score,
        color: overallColor,
        startIndex: 0,
        endIndex: text.length,
        reason: this.getReasonForScore(report.final_score, overallColor)
      });
    }

    return segments;
  }

  private scoreToColor(score: number): 'green' | 'yellow' | 'orange' | 'red' {
    if (score >= 75) return 'green';
    if (score >= 50) return 'yellow';
    if (score >= 25) return 'orange';
    return 'red';
  }

  private getReasonForScore(score: number, color: 'green' | 'yellow' | 'orange' | 'red'): string {
    const reasons = {
      green: 'Factually accurate and verified by reliable sources',
      yellow: 'Moderately correct but may lack context or contain minor inaccuracies',
      orange: 'Partially correct with some inaccuracies or missing context',
      red: 'Contains false, misleading, or manipulative information that requires correction'
    };
    return reasons[color];
  }

  private extractCorrections(report: FactCheckReport): Array<{
    original: string;
    corrected: string;
    reason: string;
    confidence: number;
  }> {
    const corrections: { original: string; corrected: string; reason: string; confidence: number; }[] = [];
    report.evidence.forEach(evidence => {
      if (evidence.score < 75 && evidence.quote) {
        corrections.push({
          original: 'Statement requiring verification',
          corrected: evidence.quote,
          reason: `According to ${evidence.publisher}: ${evidence.quote}`,
          confidence: evidence.score
        });
      }
    });
    return corrections;
  }

  private buildCorrectionPrompt(text: string, analysis: FactCheckAnalysis, mode: EditorMode): string {
    const modeInstructions = {
      'quick-fix': 'Make minimal changes to fix only the most critical factual errors while preserving the original style and tone.',
      'enhanced': 'Fix factual errors, add context where needed, improve clarity, and enhance readability while maintaining the author\'s voice.',
      'complete-rewrite': 'Completely rewrite the content to be factually accurate, well-structured, and engaging while covering the same topics.',
      'seo-optimized': 'Rewrite for SEO optimization with proper headings, keywords, and structure while ensuring factual accuracy.',
      'academic': 'Transform into formal academic writing with proper citations and scholarly tone.',
      'expansion': 'Expand the content significantly with additional context, examples, and supporting information.'
    };

    return `You are a professional content editor and fact-checker. Your task is to correct the following text based on the provided fact-check analysis.

ORIGINAL TEXT:
${text}

FACT-CHECK ANALYSIS SUMMARY:
- Overall Score: ${analysis.overallScore}/100
- Verdict: ${analysis.verdict}
- Problem Areas: ${analysis.segments.filter(s => s.score < 50).length} segments need correction

SEGMENTS NEEDING ATTENTION:
${analysis.segments.filter(s => s.score < 75).map(s =>
  `- ${s.color.toUpperCase()} (${s.score}/100): "${s.text.substring(0, 100)}..."`
).join('\n')}

EDITOR MODE: ${mode}
INSTRUCTIONS: ${modeInstructions[mode]}

CORRECTION GUIDELINES:
1. RED segments (0-24): CRITICAL - Contains false information, must be corrected
2. ORANGE segments (25-49): IMPORTANT - Add context, clarify, or correct
3. YELLOW segments (50-74): MINOR - Small improvements for accuracy
4. GREEN segments (75-100): GOOD - Preserve as is

SUPPORTING EVIDENCE:
${analysis.corrections.map(c => `- ${c.reason}`).join('\n')}

Provide ONLY the corrected text. Do not include any explanations, comments, or formatting markers. The response should be the complete, improved version that addresses all identified issues while following the ${mode} editing approach.`;
  }

  private extractCorrectedText(response: string): string {
    let cleaned = response.trim();

    // Remove code blocks and markdown
    cleaned = cleaned.replace(/```[\s\S]*?```/g, '');
    cleaned = cleaned.replace(/`([^`]*)`/g, '$1');

    // Remove common prefixes that AI might add
    const prefixes = [
      'Here is the corrected text:',
      'Corrected text:',
      'Here\'s the improved version:',
      'Improved text:',
      'The corrected version is:',
      'Here\'s the corrected content:',
      'Corrected content:',
      'The improved text:'
    ];

    for (const prefix of prefixes) {
      const regex = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'i');
      cleaned = cleaned.replace(regex, '');
    }

    return cleaned.trim();
  }

  private analyzeChanges(
    original: string,
    corrected: string,
    analysis: FactCheckAnalysis
  ): ContentChange[] {
    const changes: ContentChange[] = [];

    if (original === corrected) {
      return changes;
    }

    // Analyze changes based on problem segments
    analysis.segments.forEach((segment) => {
      if (segment.color === 'red' || segment.color === 'orange') {
        changes.push({
          type: 'modification',
          originalPhrase: segment.text.substring(0, 100) + (segment.text.length > 100 ? '...' : ''),
          newPhrase: 'Fact-checked and corrected version',
          reason: `${segment.color.toUpperCase()} segment correction: ${segment.reason}`,
          confidence: segment.score / 100,
          position: { start: segment.startIndex, end: segment.endIndex }
        });
      }
    });

    // Analyze length changes
    const wordDiff = corrected.split(' ').length - original.split(' ').length;
    if (Math.abs(wordDiff) > 10) {
      changes.push({
        type: wordDiff > 0 ? 'addition' : 'deletion',
        originalPhrase: 'Content structure',
        newPhrase: `${Math.abs(wordDiff)} words ${wordDiff > 0 ? 'added' : 'removed'}`,
        reason: `Content ${wordDiff > 0 ? 'expanded' : 'condensed'} for better accuracy and clarity`,
        confidence: 0.8,
        position: { start: 0, end: original.length }
      });
    }

    return changes;
  }

  private calculateImprovementScore(analysis: FactCheckAnalysis, changes: ContentChange[]): number {
    const baseScore = analysis.overallScore;
    const changeBonus = Math.min(30, changes.length * 5);
    const problemSegments = analysis.segments.filter(s => s.score < 50).length;
    const accuracyBonus = problemSegments > 0 ? 20 : 0;

    return Math.min(95, baseScore + changeBonus + accuracyBonus);
  }

  private calculateConfidence(analysis: FactCheckAnalysis, changes: ContentChange[]): number {
    const avgSegmentScore = analysis.segments.reduce((sum, s) => sum + s.score, 0) / analysis.segments.length;
    const changeConfidence = changes.reduce((sum, c) => sum + c.confidence, 0) / Math.max(changes.length, 1);

    return Math.round((avgSegmentScore + changeConfidence * 100) / 2);
  }

  // Storage methods (using sessionStorage for better performance)
  private saveAnalysisToStorage(text: string, analysis: FactCheckAnalysis): void {
    try {
      const storageData = {
        text,
        analysis,
        timestamp: analysis.timestamp,
        model: this.getSelectedModel()
      };
      sessionStorage.setItem('truescope-fact-check-analysis', JSON.stringify(storageData));
      console.log('✅ Fact-check analysis saved to sessionStorage');
    } catch (error) {
      console.warn('Failed to save analysis to storage:', error);
    }
  }

  private saveEditorResultToStorage(result: EditorResult): void {
    try {
      const storageData = {
        result,
        timestamp: new Date().toISOString(),
        model: this.getSelectedModel()
      };
      sessionStorage.setItem('truescope-editor-result', JSON.stringify(storageData));
      console.log('✅ Editor result saved to sessionStorage');
    } catch (error) {
      console.warn('Failed to save editor result to storage:', error);
    }
  }

  getSavedAnalysis(): { text: string; analysis: FactCheckAnalysis; timestamp: string; model: string } | null {
    try {
      const saved = sessionStorage.getItem('truescope-fact-check-analysis');
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      console.warn('Failed to retrieve saved analysis:', error);
      return null;
    }
  }

  getSavedEditorResult(): { result: EditorResult; timestamp: string; model: string } | null {
    try {
      const saved = sessionStorage.getItem('truescope-editor-result');
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      console.warn('Failed to retrieve saved editor result:', error);
      return null;
    }
  }

  // Get token usage statistics
  getTokenUsageStats(): Array<{
    timestamp: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    feature: string;
  }> {
    try {
      return JSON.parse(localStorage.getItem('truescope-token-usage') || '[]');
    } catch (error) {
      console.warn('Failed to retrieve token usage stats:', error);
      return [];
    }
  }

  // Clear token usage stats
  clearTokenUsageStats(): void {
    try {
      localStorage.removeItem('truescope-token-usage');
      console.log('✅ Token usage stats cleared');
    } catch (error) {
      console.warn('Failed to clear token usage stats:', error);
    }
  }
}