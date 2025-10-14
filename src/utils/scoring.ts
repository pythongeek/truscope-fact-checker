import { ScoreBreakdown } from '@/types';

// --- Scoring Logic ---

// Defined weights for each metric in the score breakdown.
const METRIC_WEIGHTS: Record<string, number> = {
    'Source Reliability': 0.30,
    'Corroboration': 0.30,
    'Directness': 0.20,
    'Freshness': 0.15,
    'Contradiction': 0.05, // Contradiction is treated as an inverse penalty.
};

export class FactCheckScoring {
    /**
     * Calculates the final score from a breakdown of metrics using a weighted average.
     * Note: This is a utility for client-side calculation if needed, as the AI
     * often provides the final score directly.
     */
    static calculateFinalScore(breakdown: ScoreBreakdown): number {
        if (!breakdown) {
            return 50; // Return a neutral score if no metrics are available.
        }

        let weightedTotal = 0;
        let totalWeight = 0;
        let contradictionScore = 0;

        for (const metric of breakdown.metrics) {
            const metricName = metric.name;
            const weight = METRIC_WEIGHTS[metricName];
            if (weight !== undefined) {
                if (metricName === 'Contradiction') {
                    // A higher contradiction score indicates more contradictions, which should lower the overall score.
                    contradictionScore = metric.score;
                } else {
                    weightedTotal += metric.score * weight;
                    totalWeight += weight;
                }
            }
        }

        if (totalWeight === 0) {
            return 50; // Avoid division by zero
        }
        
        const initialScore = weightedTotal / totalWeight;

        // Apply contradiction as a penalty. A score of 100 in contradiction reduces the score significantly.
        const penaltyFactor = (contradictionScore / 100) * 0.5; // Max 50% penalty
        const finalScore = initialScore * (1 - penaltyFactor);

        return Math.round(Math.max(0, Math.min(100, finalScore)));
    }

    /**
     * Determines a human-readable verdict based on a numerical score.
     */
    static determineVerdict(score: number): string {
        if (score >= 85) return 'TRUE';
        if (score >= 65) return 'Mostly True';
        if (score >= 40) return 'Mixture of True and False';
        if (score >= 15) return 'Mostly False';
        return 'FALSE';
    }

    /**
     * Determines the confidence level of an analysis based on the score and the amount of evidence.
     */
    static calculateConfidenceLevel(score: number, evidenceCount: number): 'High' | 'Medium' | 'Low' {
        if (score > 75 && evidenceCount >= 5) {
            return 'High';
        }
        if (score < 40 || evidenceCount < 2) {
            return 'Low';
        }
        return 'Medium';
    }
}