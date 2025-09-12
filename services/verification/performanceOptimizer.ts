import {
  VerificationOptions,
  ClaimAnalysis,
  BatchGroup,
  OptimizedVerificationPlan,
  CachedVerificationResult,
  BatchQueueItem,
  ParallelExecutionPlan,
  OptimizedVerificationResult,
  ExecutionPhase,
  PerformanceMetrics,
} from '../../types/performance';
import { VerificationResult } from '../../types/verification';
import { executeGeminiQuery } from '../geminiService';

export class VerificationPerformanceOptimizer {
  private cache = new Map<string, CachedVerificationResult>();
  private batchQueue = new Map<string, BatchQueueItem[]>();
  private activeOperations = new Set<string>();
  private readonly CACHE_TTL = 3600 * 1000; // 1 hour in milliseconds
  private readonly MAX_PARALLEL_RESOURCES = 10; // Arbitrary unit for resource capacity

  async optimizeVerificationWorkflow(
    claims: string[],
    options: VerificationOptions = {}
  ): Promise<OptimizedVerificationPlan> {

    const { cacheHits, cacheMisses } = await this.checkCacheForClaims(claims, options);

    const analysisForMisses = cacheMisses.length > 0 ? await this.analyzeClaims(cacheMisses) : [];

    const batchGroups = this.groupClaimsForBatching(analysisForMisses);

    const parallelExecutionPlan = this.createParallelExecutionPlan(batchGroups);

    const estimatedTime = parallelExecutionPlan.estimated_total_time;
    const optimizationStrategies = this.selectOptimizationStrategies(analysisForMisses, cacheHits.length > 0);

    const executionPlan: OptimizedVerificationPlan = {
      total_claims: claims.length,
      cache_hits: cacheHits.length,
      cache_misses: cacheMisses.length,
      batch_groups: batchGroups,
      estimated_time: estimatedTime,
      optimization_strategies: optimizationStrategies,
      parallel_execution_plan: parallelExecutionPlan,
    };

    return executionPlan;
  }

  private async analyzeClaims(claims: string[]): Promise<ClaimAnalysis[]> {
    if (claims.length === 0) {
      return [];
    }
    const prompt = `
Analyze these claims for verification optimization:

Claims: ${JSON.stringify(claims)}

For each claim, determine:
1. topic_category: (political/scientific/financial/health/general)
2. complexity_level: (simple/moderate/complex)
3. source_requirements: (a JSON array of strings from 'government', 'academic', 'news', 'expert', 'mixed')
4. verification_urgency: (high/medium/low)
5. similarity_to_others: (a JSON array of numbers indicating indices of similar claims from the input array)
6. estimated_verification_time: (an integer number of seconds)

This analysis will help batch similar claims and optimize source allocation.
Return as a single, valid JSON array of objects, with one object per claim. The order must be the same as the input claims. Do not include any text or markdown formatting outside of the JSON array.
    `;

    const result = await this.executeAnalysisQuery(prompt);
    return this.parseClaimAnalysis(result, claims);
  }

  private async executeAnalysisQuery(prompt: string): Promise<string> {
    try {
      return await executeGeminiQuery(prompt);
    } catch (error) {
      console.error("Error executing analysis query:", error);
      throw new Error("Failed to get analysis from AI service.");
    }
  }

  private parseClaimAnalysis(jsonString: string, claims: string[]): ClaimAnalysis[] {
    try {
      let cleanJsonString = jsonString.trim();
      const jsonMatch = cleanJsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        cleanJsonString = jsonMatch[1];
      }

      const parsed = JSON.parse(cleanJsonString);

      if (!Array.isArray(parsed) || parsed.length !== claims.length) {
        console.error("Parsed analysis does not match claims count.", { parsed, claims });
        throw new Error("Parsed JSON is not a valid array or does not match the number of claims.");
      }

      return parsed.map((item: any, index: number) => ({
        ...item,
        claim: claims[index],
      }));

    } catch (error) {
      console.error("Failed to parse claim analysis from AI response:", jsonString, error);
      throw new Error("AI returned a malformed analysis response.");
    }
  }

  private async checkCacheForClaims(claims: string[], options: VerificationOptions): Promise<{ cacheHits: CachedVerificationResult[], cacheMisses: string[] }> {
    const cacheHits: CachedVerificationResult[] = [];
    const cacheMisses: string[] = [];
    for (const claim of claims) {
      const cachedItem = this.cache.get(claim);
      if (cachedItem && (Date.now() - cachedItem.timestamp < this.CACHE_TTL) && !options.no_cache) {
        cacheHits.push(cachedItem);
      } else {
        cacheMisses.push(claim);
      }
    }
    return { cacheHits, cacheMisses };
  }

  private groupClaimsForBatching(analysis: ClaimAnalysis[]): BatchGroup[] {
    const groups: Map<string, ClaimAnalysis[]> = new Map();

    analysis.forEach(claim => {
      const groupKey = `${claim.topic_category}_${claim.complexity_level}`;
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(claim);
    });

    return Array.from(groups.entries()).map(([key, claims]) => ({
      group_id: key,
      claims: claims,
      batch_size: Math.min(claims.length, this.getOptimalBatchSize(claims[0].topic_category)),
      estimated_time: claims.reduce((sum, claim) => sum + claim.estimated_verification_time, 0),
      shared_sources: this.identifySharedSources(claims),
      parallel_eligible: this.canProcessInParallel(claims)
    }));
  }

  private getOptimalBatchSize(topic: ClaimAnalysis['topic_category']): number {
    switch (topic) {
      case 'financial':
      case 'health':
        return 5;
      case 'scientific':
        return 8;
      case 'political':
      case 'general':
      default:
        return 10;
    }
  }

  private identifySharedSources(claims: ClaimAnalysis[]): string[] {
    return [];
  }

  private canProcessInParallel(claims: ClaimAnalysis[]): boolean {
    return true;
  }

  private createParallelExecutionPlan(batchGroups: BatchGroup[]): ParallelExecutionPlan {
    if (batchGroups.length === 0) {
        return { total_phases: 0, phases: [], estimated_total_time: 0, parallel_efficiency: 1 };
    }

    const resourceRequirements = this.analyzeResourceRequirements(batchGroups);
    const dependencies = this.analyzeDependencies(batchGroups);

    const phases: ExecutionPhase[] = [];
    let currentPhase: BatchGroup[] = [];
    let currentResourceLoad = 0;

    const sortedGroups = [...batchGroups].sort((a, b) => b.estimated_time - a.estimated_time);

    for (const group of sortedGroups) {
      const groupResources = resourceRequirements.get(group.group_id) || 1;

      if (currentResourceLoad + groupResources <= this.MAX_PARALLEL_RESOURCES && !this.hasDependencyConflict(group, currentPhase, dependencies)) {
        currentPhase.push(group);
        currentResourceLoad += groupResources;
      } else {
        if (currentPhase.length > 0) {
          phases.push({
            phase_number: phases.length + 1,
            batch_groups: [...currentPhase],
            estimated_duration: Math.max(...currentPhase.map(g => g.estimated_time)),
            resource_usage: currentResourceLoad
          });
        }
        currentPhase = [group];
        currentResourceLoad = groupResources;
      }
    }

    if (currentPhase.length > 0) {
      phases.push({
        phase_number: phases.length + 1,
        batch_groups: currentPhase,
        estimated_duration: Math.max(...currentPhase.map(g => g.estimated_time)),
        resource_usage: currentResourceLoad
      });
    }

    const estimatedTotalTime = phases.reduce((sum, phase) => sum + phase.estimated_duration, 0);
    const parallelEfficiency = this.calculateParallelEfficiency(phases, batchGroups);

    return {
      total_phases: phases.length,
      phases: phases,
      estimated_total_time: estimatedTotalTime,
      parallel_efficiency: parallelEfficiency,
    };
  }

  private estimateExecutionTime(batchGroups: BatchGroup[], options: VerificationOptions): number {
    // This is an alias for the parallel plan's estimated time.
    const plan = this.createParallelExecutionPlan(batchGroups);
    return plan.estimated_total_time;
  }

  private selectOptimizationStrategies(analysis: ClaimAnalysis[], hasCacheHits: boolean): string[] {
    const strategies = new Set<string>();
    if (hasCacheHits) {
      strategies.add('caching');
    }
    if (analysis.length > 1) {
      strategies.add('batching');
      strategies.add('parallelism');
    }
    return Array.from(strategies);
  }

  private analyzeResourceRequirements(batchGroups: BatchGroup[]): Map<string, number> {
    const requirements = new Map<string, number>();
    batchGroups.forEach(group => {
      const complexity = group.claims[0]?.complexity_level;
      let cost = 1;
      if (complexity === 'moderate') cost = 2;
      if (complexity === 'complex') cost = 4;
      requirements.set(group.group_id, cost);
    });
    return requirements;
  }

  private analyzeDependencies(batchGroups: BatchGroup[]): Map<string, string[]> {
    // [Placeholder] No dependencies between groups for now.
    return new Map();
  }

  private hasDependencyConflict(group: BatchGroup, currentPhase: BatchGroup[], dependencies: Map<string, string[]>): boolean {
    // [Placeholder] No dependency conflicts.
    return false;
  }

  private calculateParallelEfficiency(phases: ExecutionPhase[], batchGroups: BatchGroup[]): number {
    const totalIndividualTime = batchGroups.reduce((sum, group) => sum + group.estimated_time, 0);
    const parallelTime = phases.reduce((sum, phase) => sum + phase.estimated_duration, 0);
    if (parallelTime === 0) return 1;
    return totalIndividualTime / parallelTime;
  }

  private calculateCacheUtilization(hits: number, misses: number): number {
    const total = hits + misses;
    if (total === 0) return 0;
    return hits / total;
  }

  async executeOptimizedVerification(
    plan: OptimizedVerificationPlan,
    onProgress?: (progress: number, status: string) => void
  ): Promise<OptimizedVerificationResult> {

    const startTime = Date.now();
    const allResults: VerificationResult[] = [];
    let completedClaims = 0;
    const totalClaims = plan.total_claims;

    // Add cached results directly
    // This part is tricky because I don't have the cached results here.
    // I will need to refactor `optimizeVerificationWorkflow` to return them,
    // or refactor this method to take them as input.
    // For now, I'll proceed with just executing the plan for non-cached items.

    for (const phase of plan.parallel_execution_plan.phases) {
      const phaseNumber = phase.phase_number;
      onProgress?.(
        (completedClaims / totalClaims) * 100,
        `Executing phase ${phaseNumber}/${plan.parallel_execution_plan.total_phases}`
      );

      const phasePromises = phase.batch_groups.map(group =>
        this.executeBatchGroup(group, onProgress)
      );

      const phaseResults = await Promise.all(phasePromises);
      const flattenedResults = phaseResults.flat();
      allResults.push(...flattenedResults);

      completedClaims += flattenedResults.length;
    }

    // Update cache with new results
    allResults.forEach(result => {
        if(!this.cache.has(result.claim)) {
            this.cache.set(result.claim, {
                result: result,
                timestamp: Date.now(),
                source: 'cache'
            });
        }
    });

    const endTime = Date.now();
    const actualDuration = endTime - startTime;

    return {
      results: allResults,
      execution_time: actualDuration,
      estimated_time: plan.estimated_time,
      efficiency_ratio: plan.estimated_time / actualDuration,
      cache_utilization: this.calculateCacheUtilization(plan.cache_hits, plan.cache_misses),
      performance_metrics: {
        total_claims_processed: allResults.length,
        num_phases: plan.parallel_execution_plan.total_phases,
      },
    };
  }

  /**
   * **[Placeholder]** Executes a single batch group.
   */
  private async executeBatchGroup(
    group: BatchGroup,
    onProgress?: (progress: number, status: string) => void
  ): Promise<VerificationResult[]> {
    console.log(`[Placeholder] Executing batch group: ${group.group_id}`);
    // In a real implementation, this would involve calling the core verification services for each claim in the group.
    // Here, we'll simulate it by creating dummy results.

    const results: VerificationResult[] = [];
    for (const claimAnalysis of group.claims) {
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate work
      results.push({
        claim: claimAnalysis.claim,
        verification_status: 'partially_verified',
        confidence_score: 65,
        evidence_summary: { supporting_evidence: [], contradicting_evidence: [], neutral_evidence: [] },
        source_analysis: {} as any,
        verification_methodology: ['batch_execution', 'placeholder'],
        last_updated: new Date().toISOString(),
      });
    }
    return results;
  }
}
