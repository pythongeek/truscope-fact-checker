import { EditorMode, EditorConfig, EditorResult, ContentChange } from '../types/advancedEditor';
import { FactCheckReport } from '@/types/factCheck';
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
      console.log(`🔧 Starting ${mode} editor processing...`);

      // Use custom prompt if provided, otherwise use default
      const prompt = customPrompt || this.buildPrompt(config.prompt, originalText, factCheckReport);

      // Call AI service (Gemini)
      const aiResponse = await this.callAIService(prompt, config);

      // Process and analyze changes
      const changes = this.analyzeChanges(originalText, aiResponse.content);
      const improvementScore = this.calculateImprovementScore(changes, factCheckReport);

      const processingTime = Date.now() - startTime;

      const result: EditorResult = {
        mode,
        originalText,
        editedText: aiResponse.content,
        changesApplied: changes,
        improvementScore,
        processingTime,
        confidence: aiResponse.confidence
      };

      console.log(`✅ ${mode} editor processing completed successfully`);
      return result;

    } catch (error) {
      console.error(`❌ Error in ${mode} processing:`, error);
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
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          maxOutputTokens: this.getMaxTokens(config.expectedOutputLength),
          temperature: 0.7,
        },
      });

      // FIXED: Use the correct way to extract text from Gemini API response
      let content: string = '';
      
      // Method 1: Try the text property directly (most common)
      if (result.response && result.response.text) {
        content = typeof result.response.text === 'function' ? result.response.text() : result.response.text;
      }
      // Method 2: Try candidates structure
      else if (result.response && result.response.candidates && result.response.candidates[0]) {
        const candidate = result.response.candidates[0];
        if (candidate.content && candidate.content.parts && candidate.content.parts[0]) {
          content = candidate.content.parts[0].text || '';
        }
      }
      // Method 3: Direct text access (newer SDK versions)
      else if (result.text) {
        content = typeof result.text === 'function' ? result.text() : result.text;
      }
      // Method 4: Fallback to response text
      else if ((result as any).response?.text) {
        const responseText = (result as any).response.text;
        content = typeof responseText === 'function' ? responseText() : responseText;
      }

      content = content.trim();

      if (!content) {
        throw new Error('Empty response from AI service');
      }

      // High confidence since we're using fact-checked data
      const confidence = 0.9;

      return { content, confidence };
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      throw new Error(`Failed to get response from AI service: ${error.message}`);
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
    const changes: ContentChange[] = [];

    // Simple change detection
    if (originalText !== editedText) {
      // Basic word count comparison
      const originalWords = originalText.split(/\s+/).length;
      const editedWords = editedText.split(/\s+/).length;
      
      if (editedWords > originalWords * 1.2) {
        changes.push({
          type: 'addition',
          originalPhrase: 'Content expanded',
          newPhrase: `Added ~${editedWords - originalWords} words`,
          reason: 'Content expanded with additional context and information',
          confidence: 0.8,
          position: { start: 0, end: originalText.length }
        });
      } else if (editedWords < originalWords * 0.8) {
        changes.push({
          type: 'deletion',
          originalPhrase: 'Content reduced',
          newPhrase: `Removed ~${originalWords - editedWords} words`,
          reason: 'Content streamlined and unnecessary parts removed',
          confidence: 0.8,
          position: { start: 0, end: originalText.length }
        });
      } else {
        changes.push({
          type: 'modification',
          originalPhrase: originalText.substring(0, 50) + '...',
          newPhrase: editedText.substring(0, 50) + '...',
          reason: 'Content modified for accuracy and clarity',
          confidence: 0.85,
          position: { start: 0, end: originalText.length }
        });
      }
    }

    return changes;
  }

  private calculateImprovementScore(changes: ContentChange[], factCheckReport: FactCheckReport): number {
    const baseScore = 50;
    let improvementPoints = 0;

    // Add points for each meaningful change
    changes.forEach(change => {
      switch (change.type) {
        case 'modification':
          improvementPoints += 20 * change.confidence;
          break;
        case 'addition':
          improvementPoints += 15 * change.confidence;
          break;
        case 'deletion':
          improvementPoints += 10 * change.confidence;
          break;
      }
    });

    // Factor in original accuracy score - lower original score = more room for improvement
    const originalAccuracy = factCheckReport.final_score;
    const accuracyBonus = Math.max(0, (100 - originalAccuracy) * 0.3);

    const finalScore = Math.min(95, baseScore + improvementPoints + accuracyBonus);
    return Math.round(finalScore);
  }

  getEditorModes(): EditorConfig[] {
    return Object.values(this.editorConfigs);
  }

  getEditorConfig(mode: EditorMode): EditorConfig {
    return this.editorConfigs[mode];
  }
}
