import { runFactCheckOrchestrator } from './geminiService';
import { FactCheckReport } from '../types';
import { AnalysisMethod } from '../components/InputSection';

// --- Types for Batch Processing ---

export interface BatchRequest {
    id: string; // A unique identifier for the request
    claimText: string;
    method: AnalysisMethod;
}

export interface BatchResult {
    id: string;
    request: BatchRequest;
    report?: FactCheckReport;
    error?: { message: string };
    processingTimeMs?: number;
}

export interface BatchReportSummary {
    totalRequests: number;
    successful: number;
    failed: number;
    averageProcessingTimeMs: number; // For successful requests
    averageScore: number; // For successful requests
    verdictDistribution: Record<string, number>;
}


// --- Concurrency and Rate Limiting Helper ---

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));


// --- Batch Fact-Checker Class ---

/**
 * Manages batch processing of fact-check requests with concurrency control and rate limiting.
 */
export class BatchFactChecker {
    private chunkSize: number;
    private delayBetweenChunksMs: number;

    constructor(config?: { chunkSize?: number; delayBetweenChunksMs?: number }) {
        this.chunkSize = config?.chunkSize ?? 5; // Process 5 requests at a time
        this.delayBetweenChunksMs = config?.delayBetweenChunksMs ?? 1000; // 1-second delay between chunks
    }

    /**
     * Processes an array of fact-check requests in manageable chunks.
     * @param requests - An array of BatchRequest objects.
     * @returns A promise that resolves to an array of BatchResult objects.
     */
    async processBatch(requests: BatchRequest[]): Promise<BatchResult[]> {
        const allResults: BatchResult[] = [];

        for (let i = 0; i < requests.length; i += this.chunkSize) {
            const chunk = requests.slice(i, i + this.chunkSize);
            
            console.log(`Processing chunk ${Math.floor(i / this.chunkSize) + 1} of ${Math.ceil(requests.length / this.chunkSize)}...`);

            const chunkPromises = chunk.map(async (request): Promise<BatchResult> => {
                const startTime = Date.now();
                try {
                    const report = await runFactCheckOrchestrator(request.claimText, request.method as any);
                    return {
                        id: request.id,
                        request,
                        report,
                        processingTimeMs: Date.now() - startTime,
                    };
                } catch (error: unknown) {
                    return {
                        id: request.id,
                        request,
                        error: { message: error instanceof Error ? error.message : 'An unknown error occurred' },
                        processingTimeMs: Date.now() - startTime,
                    };
                }
            });

            const chunkResults = await Promise.all(chunkPromises);
            allResults.push(...chunkResults);


            // Wait before processing the next chunk, if it's not the last one
            if (i + this.chunkSize < requests.length) {
                console.log(`Waiting for ${this.delayBetweenChunksMs}ms before next chunk...`);
                await delay(this.delayBetweenChunksMs);
            }
        }

        return allResults;
    }
}


// --- Batch Report Generation ---

/**
 * Generates a summary report from the results of a batch analysis.
 * @param batchResults - An array of BatchResult objects from a processed batch.
 * @returns A BatchReportSummary object.
 */
export const generateBatchReport = (batchResults: BatchResult[]): BatchReportSummary => {
    const summary: BatchReportSummary = {
        totalRequests: batchResults.length,
        successful: 0,
        failed: 0,
        averageProcessingTimeMs: 0,
        averageScore: 0,
        verdictDistribution: {},
    };

    let totalProcessingTime = 0;
    let totalScore = 0;

    for (const result of batchResults) {
        if (result.report) {
            summary.successful++;
            totalProcessingTime += result.processingTimeMs ?? result.report.metadata.processing_time_ms;
            totalScore += result.report.final_score;

            const verdict = result.report.final_verdict;
            summary.verdictDistribution[verdict] = (summary.verdictDistribution[verdict] || 0) + 1;
        } else {
            summary.failed++;
        }
    }

    if (summary.successful > 0) {
        summary.averageProcessingTimeMs = Math.round(totalProcessingTime / summary.successful);
        summary.averageScore = Math.round(totalScore / summary.successful);
    }

    return summary;
};
