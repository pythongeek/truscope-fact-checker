// src/services/EditorialOrchestrationService.ts
import { TieredFactCheckService } from './tieredFactCheckService';
import { autoEditorIntegration } from './autoEditorIntegration';
import { schemaGenerator } from './schemaGenerator';
import { TieredFactCheckResult, CorrectionSuggestion } from '../types';
import { ClaimReview } from 'schema-dts';

export interface EditorialPackage {
  factCheckResult: TieredFactCheckResult;
  correctionSuggestions: CorrectionSuggestion[];
  claimReviewSchema: ClaimReview;
}

export const editorialOrchestrator = {
  /**
   * Processes a piece of text to generate a full editorial package:
   * fact-check, correction suggestions, and ClaimReview schema.
   * @param text The raw text to be analyzed.
   * @returns A promise that resolves to the complete EditorialPackage.
   */
  async processText(text: string): Promise<EditorialPackage> {
    // 1. Get the comprehensive fact-check results
    const factCheckResult = await TieredFactCheckService.getInstance().performTieredCheck(text, 'journalism');

    // 2. Generate correction suggestions based on the fact-check findings
    const correctionSuggestions = await autoEditorIntegration.generateSuggestions(factCheckResult);

    // 3. Generate the ClaimReview schema based on the same findings
    const claimReviewSchema = await schemaGenerator.generate(factCheckResult);

    return {
      factCheckResult,
      correctionSuggestions,
      claimReviewSchema,
    };
  },
};