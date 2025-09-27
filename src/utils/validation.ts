import { TemporalContextService } from '../services/core/TemporalContextService';
import { SourceCredibilityService } from '../services/core/SourceCredibilityService';
import { CategoryRatingService } from '../services/core/CategoryRatingService';
import { temporalTestCases, credibilityTestCases, categoryTestCases } from './testCases';

export class ValidationRunner {
  private temporalService: TemporalContextService;
  private credibilityService: SourceCredibilityService;
  private ratingService: CategoryRatingService;

  constructor() {
    this.temporalService = TemporalContextService.getInstance();
    this.credibilityService = SourceCredibilityService.getInstance();
    this.ratingService = CategoryRatingService.getInstance();
  }

  async runAllTests(): Promise<{ passed: number; total: number; failures: string[] }> {
    const failures: string[] = [];
    let passed = 0;
    let total = 0;

    // Test temporal validation
    for (const testCase of temporalTestCases) {
      total++;
      try {
        const validations = this.temporalService.evaluateTemporalClaims(testCase.input);
        const validation = validations[0];

        if (validation && validation.isValid === testCase.expected.isValid) {
          passed++;
        } else {
          failures.push(`Temporal test failed: ${testCase.description}`);
        }
      } catch (error) {
        failures.push(`Temporal test error: ${testCase.description} - ${error}`);
      }
    }

    // Test source credibility
    for (const testCase of credibilityTestCases) {
      total++;
      try {
        const analysis = await this.credibilityService.analyzeSource(`https://${testCase.domain}`);

        if (analysis.credibilityScore === testCase.expected.credibilityScore) {
          passed++;
        } else {
          failures.push(`Credibility test failed: ${testCase.description}`);
        }
      } catch (error) {
        failures.push(`Credibility test error: ${testCase.description} - ${error}`);
      }
    }

    // Test category rating
    for (const testCase of categoryTestCases) {
      total++;
      try {
        const rating = this.ratingService.convertScoreToCategory(
          testCase.input.score,
          testCase.input.evidenceQuality,
          testCase.input.sourceCount
        );

        if (rating.category === testCase.expected.category) {
          passed++;
        } else {
          failures.push(`Category test failed: ${testCase.description}`);
        }
      } catch (error) {
        failures.push(`Category test error: ${testCase.description} - ${error}`);
      }
    }

    return { passed, total, failures };
  }
}

// Test runner function for development
export const runValidationTests = async () => {
  const runner = new ValidationRunner();
  const results = await runner.runAllTests();

  console.log(`Tests passed: ${results.passed}/${results.total}`);
  if (results.failures.length > 0) {
    console.log('Failures:');
    results.failures.forEach(failure => console.log(`  - ${failure}`));
  }

  return results;
};