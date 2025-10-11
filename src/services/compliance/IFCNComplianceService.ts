export interface IFCNComplianceReport {
  overallCompliance: number; // 0-100
  principleCompliance: {
    nonPartisanship: { score: number; details: string; recommendations: string[] };
    transparency: { score: number; details: string; recommendations: string[] };
    methodology: { score: number; details: string; recommendations: string[] };
    corrections: { score: number; details: string; recommendations: string[] };
    fairness: { score: number; details: string; recommendations: string[] };
  };
  complianceWarnings: string[];
  recommendedActions: string[];
  certificationReadiness: 'ready' | 'needs-improvement' | 'not-ready';
}

export interface CorrectionEntry {
  id: string;
  originalClaim: string;
  originalVerdict: string;
  correctedVerdict: string;
  reason: string;
  timestamp: Date;
  reviewedBy: string;
  publiclyDisclosed: boolean;
}

export class IFCNComplianceService {
  private static instance: IFCNComplianceService;
  private corrections: Map<string, CorrectionEntry> = new Map();

  static getInstance(): IFCNComplianceService {
    if (!IFCNComplianceService.instance) {
      IFCNComplianceService.instance = new IFCNComplianceService();
    }
    return IFCNComplianceService.instance;
  }

  assessCompliance(factCheckReport: any): IFCNComplianceReport {
    const principleCompliance = {
      nonPartisanship: this.assessNonPartisanship(factCheckReport),
      transparency: this.assessTransparency(factCheckReport),
      methodology: this.assessMethodology(factCheckReport),
      corrections: this.assessCorrections(factCheckReport),
      fairness: this.assessFairness(factCheckReport)
    };

    const overallCompliance = this.calculateOverallCompliance(principleCompliance);
    const complianceWarnings = this.generateComplianceWarnings(principleCompliance);
    const recommendedActions = this.generateRecommendations(principleCompliance);
    const certificationReadiness = this.assessCertificationReadiness(overallCompliance, principleCompliance);

    return {
      overallCompliance,
      principleCompliance,
      complianceWarnings,
      recommendedActions,
      certificationReadiness
    };
  }

  private assessNonPartisanship(report: any): { score: number; details: string; recommendations: string[] } {
    let score = 100;
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check for political bias in sources
    const biasWarnings = report.source_credibility_analysis?.biasWarnings || [];
    if (biasWarnings.some((w: string) => w.includes('left-leaning') || w.includes('right-leaning'))) {
      score -= 20;
      issues.push('Political bias detected in source selection');
      recommendations.push('Include sources from diverse political perspectives');
    }

    // Check for balanced evidence presentation
    const evidence = report.evidence || [];
    const supportingEvidence = evidence.filter((e: any) => e.score >= 70).length;
    const contradictingEvidence = evidence.filter((e: any) => e.score < 40).length;

    if (supportingEvidence > 0 && contradictingEvidence === 0) {
      score -= 10;
      issues.push('Only supporting evidence presented');
      recommendations.push('Include contradicting viewpoints when available');
    }

    return {
      score: Math.max(score, 0),
      details: issues.length > 0 ? issues.join('; ') : 'No significant partisanship issues detected',
      recommendations
    };
  }

  private assessTransparency(report: any): { score: number; details: string; recommendations: string[] } {
    let score = 100;
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check source attribution
    const evidence = report.evidence || [];
    const unattributedSources = evidence.filter((e: any) => !e.url || !e.publisher).length;
    if (unattributedSources > 0) {
      score -= 25;
      issues.push(`${unattributedSources} sources lack proper attribution`);
      recommendations.push('Provide URLs and publisher names for all sources');
    }

    // Check methodology disclosure
    if (!report.metadata?.method_used) {
      score -= 20;
      issues.push('Analysis methodology not disclosed');
      recommendations.push('Clearly state the fact-checking methodology used');
    }

    // Check processing transparency
    if (!report.metadata?.processing_time_ms && !report.metadata?.apisUsed) {
      score -= 15;
      issues.push('Processing details not provided');
      recommendations.push('Disclose processing methods and tools used');
    }

    return {
      score: Math.max(score, 0),
      details: issues.length > 0 ? issues.join('; ') : 'Good transparency practices observed',
      recommendations
    };
  }

  private assessMethodology(report: any): { score: number; details: string; recommendations: string[] } {
    let score = 100;
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check for systematic approach
    if (!report.score_breakdown?.final_score_formula) {
      score -= 25;
      issues.push('Scoring methodology not explained');
      recommendations.push('Provide clear scoring formula and rationale');
    }

    // Check for evidence quality assessment
    const hasEvidenceQuality = report.source_credibility_analysis || report.temporal_analysis;
    if (!hasEvidenceQuality) {
      score -= 20;
      issues.push('No evidence quality assessment performed');
      recommendations.push('Implement source credibility and temporal validation');
    }

    // Check for uncertainty handling
    const hasUncertainty = report.category_rating?.certaintyLevel || report.metadata?.warnings;
    if (!hasUncertainty) {
      score -= 15;
      issues.push('Uncertainty not properly communicated');
      recommendations.push('Express confidence levels and acknowledge limitations');
    }

    return {
      score: Math.max(score, 0),
      details: issues.length > 0 ? issues.join('; ') : 'Methodology meets professional standards',
      recommendations
    };
  }

  private assessCorrections(report: any): { score: number; details: string; recommendations: string[] } {
    let score = 100;
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check if correction system exists
    const correctionCount = this.corrections.size;
    if (correctionCount === 0) {
      score -= 10; // Not necessarily bad for new systems
      issues.push('No correction history available');
      recommendations.push('Establish systematic correction tracking');
    }

    // Check for public correction disclosure
    const publicCorrections = Array.from(this.corrections.values())
      .filter(c => c.publiclyDisclosed).length;
    const totalCorrections = this.corrections.size;

    if (totalCorrections > 0 && publicCorrections / totalCorrections < 0.8) {
      score -= 30;
      issues.push('Insufficient public disclosure of corrections');
      recommendations.push('Publicly disclose all significant corrections');
    }

    return {
      score: Math.max(score, 0),
      details: issues.length > 0 ? issues.join('; ') : 'Correction practices align with standards',
      recommendations
    };
  }

  private assessFairness(report: any): { score: number; details: string; recommendations: string[] } {
    let score = 100;
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check for context provision
    const reasoning = report.reasoning || '';
    if (reasoning.length < 100) {
      score -= 20;
      issues.push('Insufficient context provided in analysis');
      recommendations.push('Provide detailed reasoning and context for verdicts');
    }

    // Check for proportionate response
    const finalScore = report.final_score || 0;
    const evidenceCount = (report.evidence || []).length;
    if (finalScore < 30 && evidenceCount < 3) {
      score -= 15;
      issues.push('Strong negative verdict with limited evidence');
      recommendations.push('Ensure verdict severity matches evidence strength');
    }

    // Check for appropriate categorization
    const categoryRating = report.category_rating;
    if (categoryRating && categoryRating.category === 'pants-on-fire' && finalScore > 20) {
      score -= 25;
      issues.push('Harsh categorization may not match evidence');
      recommendations.push('Reserve extreme categories for clearly extreme cases');
    }

    return {
      score: Math.max(score, 0),
      details: issues.length > 0 ? issues.join('; ') : 'Fair and proportionate analysis observed',
      recommendations
    };
  }

  private calculateOverallCompliance(principles: any): number {
    const scores = Object.values(principles).map((p: any) => p.score);
    return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  }

  private generateComplianceWarnings(principles: any): string[] {
    const warnings: string[] = [];

    Object.entries(principles).forEach(([principle, data]: [string, any]) => {
      if (data.score < 70) {
        warnings.push(`${principle}: ${data.details}`);
      }
    });

    return warnings;
  }

  private generateRecommendations(principles: any): string[] {
    const recommendations: string[] = [];

    Object.values(principles).forEach((data: any) => {
      recommendations.push(...data.recommendations);
    });

    return [...new Set(recommendations)]; // Remove duplicates
  }

  private assessCertificationReadiness(overallScore: number, principles: any): 'ready' | 'needs-improvement' | 'not-ready' {
    const criticalIssues = Object.values(principles).filter((p: any) => p.score < 60).length;

    if (overallScore >= 90 && criticalIssues === 0) return 'ready';
    if (overallScore >= 70 && criticalIssues <= 1) return 'needs-improvement';
    return 'not-ready';
  }

  // Correction management methods
  addCorrection(entry: Omit<CorrectionEntry, 'id' | 'timestamp'>): string {
    const id = `correction-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const correctionEntry: CorrectionEntry = {
      ...entry,
      id,
      timestamp: new Date()
    };

    this.corrections.set(id, correctionEntry);
    return id;
  }

  getCorrections(): CorrectionEntry[] {
    return Array.from(this.corrections.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  markCorrectionPublic(correctionId: string): boolean {
    const correction = this.corrections.get(correctionId);
    if (correction) {
      correction.publiclyDisclosed = true;
      return true;
    }
    return false;
  }
}