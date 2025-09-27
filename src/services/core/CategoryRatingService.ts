export type FactCheckCategory =
  | 'true'
  | 'mostly-true'
  | 'half-true'
  | 'mostly-false'
  | 'false'
  | 'pants-on-fire'
  | 'unverifiable'
  | 'outdated'
  | 'misleading-context';

export interface CategoryRating {
  category: FactCheckCategory;
  confidence: number;
  numericScore: number; // For backward compatibility
  reasoning: string;
  evidenceStrength: 'strong' | 'moderate' | 'weak' | 'insufficient';
  certaintyLevel: 'high' | 'medium' | 'low';
}

export class CategoryRatingService {
  private static instance: CategoryRatingService;

  static getInstance(): CategoryRatingService {
    if (!CategoryRatingService.instance) {
      CategoryRatingService.instance = new CategoryRatingService();
    }
    return CategoryRatingService.instance;
  }

  convertScoreToCategory(numericScore: number, evidenceQuality: number, sourceCount: number): CategoryRating {
    // Industry-standard conversion logic
    const evidenceStrength = this.assessEvidenceStrength(evidenceQuality, sourceCount);
    const certaintyLevel = this.assessCertaintyLevel(numericScore, evidenceStrength);

    let category: FactCheckCategory;
    let reasoning: string;

    if (numericScore >= 90 && evidenceStrength !== 'insufficient') {
      category = 'true';
      reasoning = 'Claim is accurate and well-supported by reliable evidence';
    } else if (numericScore >= 75) {
      category = 'mostly-true';
      reasoning = 'Claim is largely accurate but may lack some context or contain minor inaccuracies';
    } else if (numericScore >= 50) {
      category = 'half-true';
      reasoning = 'Claim has some accurate elements but also contains inaccuracies or misleading information';
    } else if (numericScore >= 25) {
      category = 'mostly-false';
      reasoning = 'Claim contains some accurate information but is largely inaccurate or misleading';
    } else if (numericScore >= 10) {
      category = 'false';
      reasoning = 'Claim is inaccurate and contradicted by reliable evidence';
    } else {
      category = 'pants-on-fire';
      reasoning = 'Claim is not only false but ridiculously so';
    }

    // Special cases based on evidence quality
    if (evidenceStrength === 'insufficient') {
      category = 'unverifiable';
      reasoning = 'Insufficient reliable evidence available to verify this claim';
    }

    return {
      category,
      confidence: this.calculateConfidence(numericScore, evidenceStrength, sourceCount),
      numericScore,
      reasoning,
      evidenceStrength,
      certaintyLevel
    };
  }

  private assessEvidenceStrength(evidenceQuality: number, sourceCount: number): CategoryRating['evidenceStrength'] {
    if (sourceCount < 2 || evidenceQuality < 30) return 'insufficient';
    if (sourceCount >= 5 && evidenceQuality >= 80) return 'strong';
    if (sourceCount >= 3 && evidenceQuality >= 60) return 'moderate';
    return 'weak';
  }

  private assessCertaintyLevel(score: number, evidenceStrength: CategoryRating['evidenceStrength']): CategoryRating['certaintyLevel'] {
    if (evidenceStrength === 'strong' && (score >= 80 || score <= 20)) return 'high';
    if (evidenceStrength === 'insufficient') return 'low';
    if (score >= 75 || score <= 25) return 'medium';
    return 'low';
  }

  private calculateConfidence(score: number, evidenceStrength: CategoryRating['evidenceStrength'], sourceCount: number): number {
    let baseConfidence = 50;

    // Score-based confidence
    if (score >= 90 || score <= 10) baseConfidence += 30;
    else if (score >= 75 || score <= 25) baseConfidence += 20;
    else if (score >= 60 || score <= 40) baseConfidence += 10;

    // Evidence-based confidence
    switch (evidenceStrength) {
      case 'strong': baseConfidence += 25; break;
      case 'moderate': baseConfidence += 15; break;
      case 'weak': baseConfidence += 5; break;
      case 'insufficient': baseConfidence -= 20; break;
    }

    // Source count bonus
    if (sourceCount >= 5) baseConfidence += 10;
    else if (sourceCount >= 3) baseConfidence += 5;

    return Math.min(Math.max(baseConfidence, 0), 100);
  }

  getCategoryColor(category: FactCheckCategory): string {
    const colorMap: Record<FactCheckCategory, string> = {
      'true': 'green',
      'mostly-true': 'light-green',
      'half-true': 'yellow',
      'mostly-false': 'orange',
      'false': 'red',
      'pants-on-fire': 'dark-red',
      'unverifiable': 'gray',
      'outdated': 'purple',
      'misleading-context': 'blue'
    };
    return colorMap[category];
  }

  getCategoryDescription(category: FactCheckCategory): string {
    const descriptions: Record<FactCheckCategory, string> = {
      'true': 'The statement is accurate and nothing significant is missing',
      'mostly-true': 'The statement is accurate but needs clarification or additional information',
      'half-true': 'The statement is partially accurate but leaves out important details or takes things out of context',
      'mostly-false': 'The statement contains an element of truth but ignores critical facts that would give a different impression',
      'false': 'The statement is not accurate',
      'pants-on-fire': 'The statement is not accurate and makes a ridiculous claim',
      'unverifiable': 'There is insufficient evidence to determine the accuracy of this claim',
      'outdated': 'The statement was accurate at one point but is no longer current',
      'misleading-context': 'The statement is technically accurate but presented in a misleading way'
    };
    return descriptions[category];
  }
}