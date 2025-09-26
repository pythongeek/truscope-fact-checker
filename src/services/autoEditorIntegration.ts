import { FactCheckReport } from '../types/factCheck';
import { EditorMode, EditorResult, ContentChange, FactCheckSegment, FactCheckAnalysis } from '../types/advancedEditor';
import { runFactCheckOrchestrator } from './geminiService';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getGeminiApiKey } from './apiKeyService';

export class AutoEditorIntegrationService {
  private static instance: AutoEditorIntegrationService;
  private ai: GoogleGenerativeAI;

  constructor() {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      throw new Error("Missing Gemini API key");
    }
    this.ai = new GoogleGenerativeAI(apiKey);
  }

  static getInstance(): AutoEditorIntegrationService {
    if (!AutoEditorIntegrationService.instance) {
      AutoEditorIntegrationService.instance = new AutoEditorIntegrationService();
    }
    return AutoEditorIntegrationService.instance;
  }

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

  async performAutoCorrection(
    originalText: string,
    analysis: FactCheckAnalysis,
    mode: EditorMode = 'enhanced'
  ): Promise<EditorResult> {
    console.log('🤖 Starting auto-correction with mode:', mode);

    try {
      const prompt = this.buildCorrectionPrompt(originalText, analysis, mode);
      const model = this.ai.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(prompt);

      const responseText = result.response.text();
      const correctedText = this.extractCorrectedText(responseText);
      const changes = this.analyzeChanges(originalText, correctedText, analysis);

      const editorResult: EditorResult = {
        mode,
        originalText,
        editedText: correctedText,
        changesApplied: changes,
        improvementScore: this.calculateImprovementScore(analysis, changes),
        processingTime: Date.now() - Date.now(),
        confidence: this.calculateConfidence(analysis, changes)
      };

      this.saveEditorResultToStorage(editorResult);
      console.log('✅ Auto-correction completed with', changes.length, 'changes');
      return editorResult;

    } catch (error: any) {
      console.error('❌ Auto-correction failed:', error);
      throw new Error(`Auto-correction failed: ${error.message}`);
    }
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

FACT-CHECK ANALYSIS:
${JSON.stringify(analysis.segments.map(s => ({
  text: s.text,
  score: s.score,
  color: s.color,
  reason: s.reason
})), null, 2)}

EDITOR MODE: ${mode}
INSTRUCTIONS: ${modeInstructions[mode]}

CORRECTION GUIDELINES:
1. RED segments (0-24): These contain false or misleading information - MUST be corrected
2. ORANGE segments (25-49): Partially correct - add context or clarify
3. YELLOW segments (50-74): Moderately correct - minor improvements needed
4. GREEN segments (75-100): Accurate - preserve as is

EVIDENCE FOR CORRECTIONS:
${analysis.corrections.map(c => `- ${c.reason}`).join('\n')}

Provide ONLY the corrected text without any explanations or comments. The response should be the improved version of the original text that addresses all factual issues while following the editor mode instructions.`;
  }

  private extractCorrectedText(response: string): string {
    let cleaned = response.trim();
    cleaned = cleaned.replace(/```[\s\S]*?```/g, '');
    cleaned = cleaned.replace(/`([^`]*)`/g, '$1');

    const prefixes = [
      'Here is the corrected text:',
      'Corrected text:',
      'Here\'s the improved version:',
      'Improved text:',
      'The corrected version is:'
    ];

    for (const prefix of prefixes) {
      if (cleaned.toLowerCase().startsWith(prefix.toLowerCase())) {
        cleaned = cleaned.substring(prefix.length).trim();
      }
    }

    return cleaned;
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

  private saveAnalysisToStorage(text: string, analysis: FactCheckAnalysis): void {
    try {
      const storageData = {
        text,
        analysis,
        timestamp: analysis.timestamp
      };
      localStorage.setItem('truescope-fact-check-analysis', JSON.stringify(storageData));
      console.log('✅ Fact-check analysis saved to localStorage');
    } catch (error) {
      console.warn('Failed to save analysis to storage:', error);
    }
  }

  private saveEditorResultToStorage(result: EditorResult): void {
    try {
      const storageData = {
        result,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem('truescope-editor-result', JSON.stringify(storageData));
      console.log('✅ Editor result saved to localStorage');
    } catch (error) {
      console.warn('Failed to save editor result to storage:', error);
    }
  }

  getSavedAnalysis(): { text: string; analysis: FactCheckAnalysis; timestamp: string } | null {
    try {
      const saved = localStorage.getItem('truescope-fact-check-analysis');
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      console.warn('Failed to retrieve saved analysis:', error);
      return null;
    }
  }

  getSavedEditorResult(): { result: EditorResult; timestamp: string } | null {
    try {
      const saved = localStorage.getItem('truescope-editor-result');
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      console.warn('Failed to retrieve saved editor result:', error);
      return null;
    }
  }
}