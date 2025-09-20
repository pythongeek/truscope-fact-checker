import { FactCheckReport } from '../types/factCheck';
import { MultiSourceVerifier } from './multiSourceVerifier';
import { AdvancedEvidenceScorer } from './advancedScoring';
import { IntelligentCorrector } from './intelligentCorrector';
import { SmartCorrection, CorrectionAnalysis } from '../types/corrections';

export class EnhancedFactCheckService {
  private multiSourceVerifier: MultiSourceVerifier;
  private evidenceScorer: AdvancedEvidenceScorer;
  private intelligentCorrector: IntelligentCorrector;

  constructor() {
    this.multiSourceVerifier = new MultiSourceVerifier();
    this.evidenceScorer = new AdvancedEvidenceScorer();
    this.intelligentCorrector = new IntelligentCorrector();
  }

  async enhanceFactCheckReport(
    baseReport: FactCheckReport,
    originalText: string
  ): Promise<{
    enhancedReport: FactCheckReport;
    corrections: SmartCorrection[];
    correctionAnalysis: CorrectionAnalysis;
  }> {
    try {
      // 1. Get additional sources
      const additionalSources = await this.multiSourceVerifier
        .verifyWithMultipleSources(originalText);

      // 2. Enhance evidence with advanced scoring
      const enhancedEvidence = baseReport.evidence.map(evidence =>
        this.evidenceScorer.enhanceEvidenceWithMetadata(evidence)
      );

      // 3. Add evidence from additional sources
      const allEvidence = [
        ...enhancedEvidence,
        ...additionalSources.flatMap(source => source.results)
      ];

      // 4. Analyze for corrections
      const correctionAnalysis = await this.intelligentCorrector
        .analyzeForCorrections(originalText, allEvidence);

      // 5. Generate smart corrections if issues found
      const corrections = correctionAnalysis.totalIssues > 0
        ? await this.intelligentCorrector.generateSmartCorrections(
            originalText,
            correctionAnalysis.issues, // Correctly passing the issues
            allEvidence
          )
        : [];

      // 6. Update the report with enhanced data
      const enhancedReport: FactCheckReport = {
        ...baseReport,
        evidence: allEvidence,
        metadata: {
          ...baseReport.metadata,
          sources_consulted: {
            total: allEvidence.length,
            high_credibility: allEvidence.filter(e => e.score > 80).length,
            conflicting: allEvidence.filter(e => e.contradictsClaim).length
          },
          warnings: [
            ...baseReport.metadata.warnings,
            ...(additionalSources.length === 0 ? ['Limited external source verification'] : [])
          ]
        },
        // Add new fields for corrections
        correctionAnalysis,
        availableCorrections: corrections.length
      };

      return {
        enhancedReport,
        corrections,
        correctionAnalysis
      };
    } catch (error) {
      console.error('Error enhancing fact-check report:', error);
      throw new Error('Failed to enhance fact-check report');
    }
  }
}
