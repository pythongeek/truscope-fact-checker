
import type { EvidenceItem } from '@/types';

interface ValidatedEvidenceItem extends EvidenceItem {
  isValid: boolean;
  accessibility: 'accessible' | 'inaccessible' | 'error';
  credibilityScore: number;
  warnings: string[];
}

interface CitationValidationResult {
  citations: ValidatedEvidenceItem[];
}

export class CitationValidatorService {
  private static instance: CitationValidatorService;

  private constructor() {}

  public static getInstance(): CitationValidatorService {
    if (!CitationValidatorService.instance) {
      CitationValidatorService.instance = new CitationValidatorService();
    }
    return CitationValidatorService.instance;
  }

  async validateCitations(evidence: EvidenceItem[]): Promise<CitationValidationResult> {
    const citationsToValidate = evidence.map(item => ({
      url: item.url || '',
      publisher: item.publisher,
      quote: item.quote,
    }));

    try {
      const response = await fetch('/api/validate-citations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ citations: citationsToValidate }),
      });

      if (!response.ok) {
        throw new Error(`Citation validation failed with status: ${response.status}`);
      }

      const result: CitationValidationResult = await response.json();
      return result;

    } catch (error) {
      console.error('Error in CitationValidatorService:', error);
      // Return a result that marks all as failed
      const failedResult: ValidatedEvidenceItem[] = evidence.map(item => ({
        ...item,
        isValid: false,
        accessibility: 'error',
        credibilityScore: 0,
        warnings: ['Failed to connect to the validation service.'],
      }));
      return { citations: failedResult };
    }
  }
}
