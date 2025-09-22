import { EditorMode, EditorConfig, EditorResult, ContentChange } from '../types/advancedEditor';
import { FactCheckReport } from '../types/factCheck';
import { GoogleGenAI } from "@google/genai";
import { getGeminiApiKey } from './apiKeyService';
import { parseAIJsonResponse } from '../utils/jsonParser';

export class AdvancedCorrectorService {
  private static instance: AdvancedCorrectorService;
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: getGeminiApiKey() });
  }
  private readonly editorConfigs: Record<EditorMode, EditorConfig> = {
    'quick-fix': {
      id: 'quick-fix',
      name: 'Quick Fix',
      description: 'Fix only factually incorrect statements while preserving writing style',
      prompt: `Fix only the factually incorrect statements in the following text while preserving the original tone, style, and structure. Make minimal changes and maintain the author's voice. Focus on:
      1. Correcting false factual claims
      2. Removing misleading statistics
      3. Updating outdated information

      Original Text: {originalText}

      Fact Check Report: {factCheckReport}

      Return only the corrected text with minimal changes.`,
      expectedOutputLength: 'preserve',
      processingTime: 'fast',
      costTier: 'low'
    },
    'enhanced': {
      id: 'enhanced',
      name: 'Enhanced Mode',
      description: 'Fix errors, add context and citations, improve clarity',
      prompt: `Enhance the following text by fixing factual errors, adding proper citations, and improving clarity while preserving the core message. Focus on:
      1. Correcting all factual inaccuracies
      2. Adding credible source citations
      3. Providing additional context where needed
      4. Improving readability and flow
      5. Strengthening weak claims with evidence

      Original Text: {originalText}

      Fact Check Report: {factCheckReport}

      Return enhanced text with inline citations and improved clarity.`,
      expectedOutputLength: 'expand',
      processingTime: 'medium',
      costTier: 'medium'
    },
    'complete-rewrite': {
      id: 'complete-rewrite',
      name: 'Complete Rewrite',
      description: 'Generate entirely new, comprehensive, factually accurate content',
      prompt: `Create a completely new, comprehensive, and factually accurate piece of content on the same topic as the original text. Use the fact-check report to ensure accuracy. Focus on:
      1. Maintaining the core topic and key points
      2. Ensuring all information is factually correct
      3. Creating engaging, well-structured content
      4. Including proper citations and sources
      5. Adding valuable insights and context

      Original Text: {originalText}

      Fact Check Report: {factCheckReport}

      Create a comprehensive rewrite that is factually accurate and engaging.`,
      expectedOutputLength: 'comprehensive',
      processingTime: 'slow',
      costTier: 'high'
    },
    'seo-optimized': {
      id: 'seo-optimized',
      name: 'SEO Optimized',
      description: 'Generate SEO-friendly content with headings and meta descriptions',
      prompt: `Optimize the following text for search engines while maintaining factual accuracy. Focus on:
      1. Structuring with proper H1, H2, H3 headings
      2. Including target keywords naturally
      3. Creating meta description suggestions
      4. Adding internal linking opportunities
      5. Ensuring readability and user engagement
      6. Maintaining factual accuracy based on the fact-check report

      Original Text: {originalText}

      Fact Check Report: {factCheckReport}

      Return SEO-optimized content with suggested meta descriptions and heading structure.`,
      expectedOutputLength: 'expand',
      processingTime: 'medium',
      costTier: 'medium'
    },
    'academic': {
      id: 'academic',
      name: 'Academic Mode',
      description: 'Transform to formal academic style with extensive citations',
      prompt: `Transform the following text into formal academic writing with extensive peer-reviewed citations. Focus on:
      1. Using formal academic language and structure
      2. Adding comprehensive citations from credible sources
      3. Including methodology where applicable
      4. Maintaining objective tone
      5. Following academic writing conventions
      6. Ensuring all claims are properly supported

      Original Text: {originalText}

      Fact Check Report: {factCheckReport}

      Return academically formatted text with proper citations and formal structure.`,
      expectedOutputLength: 'comprehensive',
      processingTime: 'slow',
      costTier: 'high'
    },
    'expansion': {
      id: 'expansion',
      name: 'Expansion Mode',
      description: 'Expand with supporting evidence, statistics, and FAQ section',
      prompt: `Significantly expand the following text with supporting evidence, statistics, and additional context. Include a comprehensive FAQ section. Focus on:
      1. Adding supporting statistics and data
      2. Including expert quotes and opinions
      3. Providing historical context
      4. Creating a comprehensive FAQ section
      5. Adding practical examples and case studies
      6. Ensuring all additions are factually accurate

      Original Text: {originalText}

      Fact Check Report: {factCheckReport}

      Return significantly expanded content with FAQ section and comprehensive supporting information.`,
      expectedOutputLength: 'comprehensive',
      processingTime: 'slow',
      costTier: 'high'
    }
  };

  static getInstance(): AdvancedCorrectorService {
    if (!AdvancedCorrectorService.instance) {
      AdvancedCorrectorService.instance = new AdvancedCorrectorService();
    }
    return AdvancedCorrectorService.instance;
  }

  async processContent(
    mode: EditorMode,
    originalText: string,
    factCheckReport: FactCheckReport,
    customPrompt?: string
  ): Promise<EditorResult> {
    const startTime = Date.now();
    const config = this.editorConfigs[mode];

    try {
      // Use custom prompt if provided, otherwise use default
      const prompt = customPrompt || this.buildPrompt(config.prompt, originalText, factCheckReport);

      // Call AI service (Gemini, GPT-4, etc.)
      const aiResponse = await this.callAIService(prompt, config);

      // Process and analyze changes
      const changes = this.analyzeChanges(originalText, aiResponse.content);
      const improvementScore = this.calculateImprovementScore(changes, factCheckReport);

      const processingTime = Date.now() - startTime;

      return {
        mode,
        originalText,
        editedText: aiResponse.content,
        changesApplied: changes,
        improvementScore,
        processingTime,
        confidence: aiResponse.confidence
      };
    } catch (error) {
      console.error(`Error in ${mode} processing:`, error);
      throw new Error(`Failed to process content in ${mode} mode: ${error.message}`);
    }
  }

  private buildPrompt(template: string, originalText: string, factCheckReport: FactCheckReport): string {
    return template
      .replace('{originalText}', originalText)
      .replace('{factCheckReport}', JSON.stringify(factCheckReport, null, 2));
  }

  private async callAIService(prompt: string, config: EditorConfig): Promise<{content: string, confidence: number}> {
    try {
      const result = await this.ai.models.generateContent({
        model: "gemini-2.5-flash", // Using a model consistent with the rest of the app
        contents: prompt,
        config: {
          maxOutputTokens: this.getMaxTokens(config.expectedOutputLength),
          temperature: 0.7, // A reasonable temperature for creative but controlled output
        },
      });

      // The response text is what we need. We'll assume it's the corrected content.
      const content = result.text.trim();

      // We don't get a confidence score directly from this API call,
      // so we'll use a high default confidence and the caller can adjust.
      const confidence = 0.9;

      return { content, confidence };
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      throw new Error('Failed to get response from AI service.');
    }
  }

  private getMaxTokens(outputLength: EditorConfig['expectedOutputLength']): number {
    switch (outputLength) {
      case 'preserve': return 2000;
      case 'expand': return 4000;
      case 'comprehensive': return 8000;
      default: return 2000;
    }
  }

  private analyzeChanges(originalText: string, editedText: string): ContentChange[] {
    // Implement diff algorithm to identify changes
    // This is a simplified version - you'd want a more sophisticated diff algorithm
    const changes: ContentChange[] = [];

    // Basic word-level comparison
    const originalWords = originalText.split(/\s+/);
    const editedWords = editedText.split(/\s+/);

    // Simple change detection (you'd implement a proper diff algorithm)
    if (originalWords.length !== editedWords.length) {
      changes.push({
        type: 'modification',
        originalPhrase: originalText.substring(0, 50) + '...',
        newPhrase: editedText.substring(0, 50) + '...',
        reason: 'Content structure modified',
        confidence: 0.8,
        position: { start: 0, end: originalText.length }
      });
    }

    return changes;
  }

  private calculateImprovementScore(changes: ContentChange[], factCheckReport: FactCheckReport): number {
    // Calculate improvement based on changes and fact-check report
    const baseScore = 50;
    let improvementPoints = 0;

    // Add points for each meaningful change
    changes.forEach(change => {
      switch (change.type) {
        case 'modification':
          improvementPoints += 15 * change.confidence;
          break;
        case 'addition':
          improvementPoints += 10 * change.confidence;
          break;
        case 'deletion':
          improvementPoints += 5 * change.confidence;
          break;
      }
    });

    // Factor in original accuracy score
    const originalAccuracy = factCheckReport.final_score;
    const accuracyBonus = (100 - originalAccuracy) * 0.5;

    return Math.min(100, baseScore + improvementPoints + accuracyBonus);
  }

  getEditorModes(): EditorConfig[] {
    return Object.values(this.editorConfigs);
  }

  getEditorConfig(mode: EditorMode): EditorConfig {
    return this.editorConfigs[mode];
  }
}
