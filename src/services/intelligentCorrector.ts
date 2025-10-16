// src/services/intelligentCorrector.ts
import {
  SmartCorrection,
  DetectedIssue,
  CorrectionAnalysis,
} from '@/types/corrections';
import { AdvancedEvidence } from '@/types/enhancedFactCheck';
// CHANGE: All old Google AI imports are removed. We now only use our secure service.
import { vertexAiService } from './vertexAiService';
import { parseAIJsonResponse } from '../utils/jsonParser';
import { logger } from '../utils/logger';

export class IntelligentCorrector {
  // The constructor and direct AI initialization are no longer needed.

  async analyzeForCorrections(
    originalText: string,
    evidence: AdvancedEvidence[]
  ): Promise<CorrectionAnalysis> {
    const prompt = `
      You are an expert fact-checker and editor. Analyze the following text for factual errors, misleading context, outdated information, and missing context.

      Original Text: "${originalText}"

      Supporting Evidence:
      ${evidence.map(e => e.quote ? `- ${e.publisher}: "${e.quote}" (Reliability: ${e.sourceCredibility}/100)` : '').join('\n')}

      Identify and categorize all issues. For each issue, provide:
      1. Type (factual_error, misleading_context, outdated_info, missing_context, unsupported_claim)
      2. Severity (low, medium, high, critical)
      3. Exact text location
      4. Description of the issue
      5. Confidence in your assessment (0-100)

      Respond with a valid JSON object matching this exact structure:
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
      // CHANGE: Instead of calling the Google AI library directly, we call our secure service.
      const responseText = await vertexAiService.generateText(prompt);
      const response = parseAIJsonResponse(responseText);

      const issues: DetectedIssue[] = response.issues || [];

      return {
        totalIssues: issues.length,
        issuesByType: this.categorizeByType(issues),
        issuesBySeverity: this.categorizeBySeverity(issues),
        overallAccuracy: response.overallAccuracy || 0,
        recommendedAction: response.recommendedAction || 'no_action_needed',
        issues: issues,
      };
    } catch (error) {
      logger.error('Error analyzing for corrections with Vertex AI:', error);
      throw new Error('Failed to analyze text for corrections via Vertex AI service.');
    }
  }

  async generateSmartCorrections(
    originalText: string,
    issues: DetectedIssue[],
    evidence: AdvancedEvidence[]
  ): Promise<SmartCorrection[]> {
    // This function can now run correction generations in parallel for better performance.
    const correctionPromises = issues.map(issue =>
      this.generateSingleCorrection(originalText, issue, evidence)
    );

    const corrections = await Promise.all(correctionPromises);
    // Filter out any null results from failed individual corrections
    return corrections.filter((c): c is SmartCorrection => c !== null);
  }

  private async generateSingleCorrection(
    originalText: string,
    issue: DetectedIssue,
    evidence: AdvancedEvidence[]
  ): Promise<SmartCorrection | null> {
    const relevantEvidence = evidence.filter(e =>
      e.quote && (e.quote.toLowerCase().includes(issue.originalText.toLowerCase()))
    );

    const prompt = `
      Generate a correction for this specific issue found in a larger text.

      Original Text Context: "${originalText}"
      Problematic Part: "${issue.originalText}"
      Issue Type: ${issue.type}
      Issue Description: ${issue.description}

      Relevant Evidence:
      ${relevantEvidence.map(e => e.quote ? `- ${e.publisher}: "${e.quote}"` : '').join('\n')}

      Provide a detailed correction. Respond in a valid JSON format with the following structure:
      {
        "correctedStatement": "The corrected version of the problematic text.",
        "correctInformation": "A clear statement of the actual facts.",
        "alternativePhrasings": ["Option one for the correction", "Option two for the correction"],
        "correctionReasoning": "A detailed explanation of why the correction is necessary.",
        "confidence": 90
      }
    `;

    try {
      // CHANGE: All AI calls now use the centralized vertexAiService.
      const responseText = await vertexAiService.generateText(prompt);
      const response = parseAIJsonResponse(responseText);

      return {
        id: `correction-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        originalStatement: issue.originalText,
        correctedStatement: response.correctedStatement,
        specificIssues: [issue],
        correctInformation: response.correctInformation,
        supportingSources: relevantEvidence,
        confidence: response.confidence,
        alternativePhrasings: response.alternativePhrasings || [],
        correctionReasoning: response.correctionReasoning,
      };
    } catch (error) {
      logger.error('Error generating single correction with Vertex AI:', { issue, error });
      return null; // Return null if a single correction fails, so others can proceed.
    }
  }

  // Helper functions remain unchanged as they are pure data processors.
  private categorizeByType(issues: DetectedIssue[]): Record<DetectedIssue['type'], number> {
    const categories: Record<DetectedIssue['type'], number> = {
      factual_error: 0,
      misleading_context: 0,
      outdated_info: 0,
      missing_context: 0,
      unsupported_claim: 0
    };
    issues.forEach(issue => {
      if (issue.type in categories) {
        categories[issue.type]++;
      }
    });
    return categories;
  }

  private categorizeBySeverity(issues: DetectedIssue[]): Record<DetectedIssue['severity'], number> {
    const categories: Record<DetectedIssue['severity'], number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };
    issues.forEach(issue => {
      if (issue.severity in categories) {
        categories[issue.severity]++;
      }
    });
    return categories;
  }
}
