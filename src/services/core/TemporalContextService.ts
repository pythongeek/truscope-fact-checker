export interface TemporalValidation {
  isValid: boolean;
  context: string;
  confidence: number;
  dateType: 'past' | 'present' | 'near_future' | 'far_future';
  reasoning: string;
}

export interface TemporalAnalysis {
  hasTemporalClaims: boolean;
  validations: TemporalValidation[];
  overallTemporalScore: number;
  temporalWarnings: string[];
}

export class TemporalContextService {
  private static instance: TemporalContextService;

  static getInstance(): TemporalContextService {
    if (!TemporalContextService.instance) {
      TemporalContextService.instance = new TemporalContextService();
    }
    return TemporalContextService.instance;
  }

  validateClaim(dateStr: string, contextDate: Date = new Date()): TemporalValidation {
    try {
      const claimDate = this.extractDate(dateStr);
      if (!claimDate) {
        return {
          isValid: false,
          context: 'Unable to extract valid date',
          confidence: 0,
          dateType: 'present',
          reasoning: 'Date format not recognized'
        };
      }

      const daysDiff = (contextDate.getTime() - claimDate.getTime()) / (1000 * 3600 * 24);

      return {
        isValid: this.isDateValid(daysDiff),
        context: this.getTemporalContext(daysDiff),
        confidence: this.calculateTemporalConfidence(daysDiff),
        dateType: this.getDateType(daysDiff),
        reasoning: this.getReasoningForDate(daysDiff, dateStr)
      };
    } catch (error) {
      return {
        isValid: false,
        context: 'Error processing date',
        confidence: 0,
        dateType: 'present',
        reasoning: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private extractDate(dateStr: string): Date | null {
    // Handle various date formats
    const patterns = [
      /(\w+)\s+(\d{4})/i, // "August 2025"
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/, // "8/15/2025"
      /(\d{4})-(\d{1,2})-(\d{1,2})/, // "2025-08-15"
      /(\d{1,2})\s+(\w+)\s+(\d{4})/i // "15 August 2025"
    ];

    for (const pattern of patterns) {
      const match = dateStr.match(pattern);
      if (match) {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }

    return null;
  }

  private isDateValid(daysDiff: number): boolean {
    // FIXED: Allow past dates, only reject far future (>1 year)
    return daysDiff >= -365;
  }

  private getTemporalContext(daysDiff: number): string {
    if (daysDiff < -365) return "Far future claim - requires speculation";
    if (daysDiff < -90) return "Future claim - may be predictable";
    if (daysDiff < -30) return "Near future claim - within prediction range";
    if (daysDiff < 0) return "Recent future claim - highly predictable";
    if (daysDiff <= 30) return "Recent past - highly verifiable";
    if (daysDiff <= 365) return "Past year - verifiable with documentation";
    if (daysDiff <= 1825) return "Past 5 years - verifiable with archives";
    return "Historical claim - requires archival verification";
  }

  private getDateType(daysDiff: number): 'past' | 'present' | 'near_future' | 'far_future' {
    if (daysDiff < -365) return 'far_future';
    if (daysDiff < -30) return 'near_future';
    if (daysDiff >= -30 && daysDiff <= 30) return 'present';
    return 'past';
  }

  private calculateTemporalConfidence(daysDiff: number): number {
    if (daysDiff < -365) return 20; // Far future - low confidence
    if (daysDiff < -90) return 60;  // Future but predictable
    if (daysDiff < -30) return 80;  // Near future - high confidence
    if (daysDiff <= 30) return 95;  // Recent past/present - very high
    if (daysDiff <= 365) return 90; // Past year - high confidence
    if (daysDiff <= 1825) return 75; // Past 5 years - good confidence
    return 60; // Historical - moderate confidence
  }

  private getReasoningForDate(daysDiff: number, originalDate: string): string {
    if (daysDiff < -365) {
      return `Date "${originalDate}" is more than 1 year in the future, making verification speculative`;
    }
    if (daysDiff < 0) {
      return `Date "${originalDate}" is in the future but within predictable range`;
    }
    if (daysDiff <= 30) {
      return `Date "${originalDate}" is recent and highly verifiable`;
    }
    return `Date "${originalDate}" is in the past and can be verified through documentation`;
  }

  // Helper method for integration with existing fact-checking
  evaluateTemporalClaims(text: string): TemporalValidation[] {
    const datePatterns = [
      /(\w+\s+\d{4})/g, // "August 2025"
      /(\d{1,2}\/\d{1,2}\/\d{4})/g, // "8/15/2025"
      /(\d{4}-\d{1,2}-\d{1,2})/g, // "2025-08-15"
      /(\d{1,2}\s+\w+\s+\d{4})/g // "15 August 2025"
    ];

    const foundDates: string[] = [];
    datePatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        foundDates.push(...matches);
      }
    });

    return foundDates.map(dateStr => this.validateClaim(dateStr));
  }
}