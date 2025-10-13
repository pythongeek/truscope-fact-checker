import { SmartCorrection, DetectedIssue, CorrectionAnalysis } from '@/types/corrections';
import { AdvancedEvidence } from '@/types/enhancedFactCheck';
import { getGeminiApiKey, getGeminiModel } from './apiKeyService';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { parseAIJsonResponse } from '../utils/jsonParser';

export class IntelligentCorrector {
  private ai: GoogleGenerativeAI;

  constructor() {
    this.ai = new GoogleGenerativeAI(getGeminiApiKey());
  }

  async analyzeForCorrections(
    originalText: string,
    evidence: AdvancedEvidence[]
  ): Promise<CorrectionAnalysis> {

    const model = this.ai.getGenerativeModel({ model: getGeminiModel() });

    const prompt = `
      You are an expert fact-checker and editor. Analyze the following text for factual errors, misleading context, outdated information, and missing context.

      Original Text: "${originalText}"

      Supporting Evidence:
      ${evidence.map(e => `- ${e.publisher}: "${e.quote}" (Reliability: ${e.sourceCredibility}/100)`).join('\n')}

      Identify and categorize all issues. For each issue, provide:
      1. Type (factual_error, misleading_context, outdated_info, missing_context, unsupported_claim)
      2. Severity (low, medium, high, critical)
      3. Exact text location
      4. Description of the issue
      5. Confidence in your assessment (0-100)

      Respond with a JSON object matching this structure:
      {
        "issues": [
          {
            "type": "factual_error",
            "severity": "high",
            "originalText": "specific text with issue",
            "startIndex": 0,
            "endIndex": 10,
            "description": "explanation of the issue",
            "confidence": 85
          }
        ],
        "overallAccuracy": 75,
        "recommendedAction": "major_revision"
      }
    `;

    try {
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      const response = parseAIJsonResponse(responseText);

      return {
        totalIssues: response.issues.length,
        issuesByType: this.categorizeByType(response.issues),
        issuesBySeverity: this.categorizeBySeverity(response.issues),
        overallAccuracy: response.overallAccuracy,
        recommendedAction: response.recommendedAction,
        issues: response.issues || []
      };
    } catch (error) {
      console.error('Error analyzing corrections:', error);
      throw new Error('Failed to analyze text for corrections');
    }
  }

  async generateSmartCorrections(
    originalText: string,
    issues: DetectedIssue[],
    evidence: AdvancedEvidence[]
  ): Promise<SmartCorrection[]> {

    const corrections: SmartCorrection[] = [];

    for (const issue of issues) {
      const correction = await this.generateSingleCorrection(originalText, issue, evidence);
      if (correction) {
        corrections.push(correction);
      }
    }

    return corrections;
  }

  private async generateSingleCorrection(
    originalText: string,
    issue: DetectedIssue,
    evidence: AdvancedEvidence[]
  ): Promise<SmartCorrection | null> {

    const model = this.ai.getGenerativeModel({ model: getGeminiModel() });

    const relevantEvidence = evidence.filter(e =>
      e.quote.toLowerCase().includes(issue.originalText.toLowerCase()) ||
      issue.originalText.toLowerCase().includes(e.quote.toLowerCase())
    );

    const prompt = `
      Generate a correction for this specific issue:

      Original Text: "${originalText}"
      Problematic Part: "${issue.originalText}"
      Issue Type: ${issue.type}
      Issue Description: ${issue.description}

      Relevant Evidence:
      ${relevantEvidence.map(e => `- ${e.publisher}: "${e.quote}"`).join('\n')}

      Provide:
      1. A corrected version of the problematic text
      2. The correct information that should be stated
      3. 2-3 alternative ways to phrase the correction
      4. Explanation of why this correction is needed

      Respond in JSON format:
      {
        "correctedStatement": "corrected version of the text",
        "correctInformation": "what the facts actually say",
        "alternativePhrasings": ["option 1", "option 2", "option 3"],
        "correctionReasoning": "detailed explanation",
        "confidence": 85
      }
    `;

    try {
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      const response = parseAIJsonResponse(responseText);

      return {
        id: `correction-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        originalStatement: issue.originalText,
        correctedStatement: response.correctedStatement,
        specificIssues: [issue],
        correctInformation: response.correctInformation,
        supportingSources: relevantEvidence,
        confidence: response.confidence,
        alternativePhrasings: response.alternativePhrasings,
        correctionReasoning: response.correctionReasoning
      };
    } catch (error) {
      console.error('Error generating single correction:', error);
      return null;
    }
  }

  private categorizeByType(issues: any[]): Record<DetectedIssue['type'], number> {
    const categories: Record<DetectedIssue['type'], number> = {
      factual_error: 0,
      misleading_context: 0,
      outdated_info: 0,
      missing_context: 0,
      unsupported_claim: 0
    };

    issues.forEach(issue => {
      if (categories.hasOwnProperty(issue.type)) {
        categories[issue.type]++;
      }
    });

    return categories;
  }

  private categorizeBySeverity(issues: any[]): Record<DetectedIssue['severity'], number> {
    const categories: Record<DetectedIssue['severity'], number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };

    issues.forEach(issue => {
      if (categories.hasOwnProperty(issue.severity)) {
        categories[issue.severity]++;
      }
    });

    return categories;
  }
}
