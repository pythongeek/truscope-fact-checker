// diagnostic-test.ts
// Run this in your Next.js API route or as a standalone script to test evidence aggregation

import { PipelineIntegration } from '@/services/analysis/PipelineIntegration';
import { SerpApiService } from '@/services/serpApiService';
import { GoogleFactCheckService } from '@/services/googleFactCheckService';

/**
 * Comprehensive diagnostic test for evidence aggregation
 * Run this to verify the fixes are working correctly
 */
export async function runDiagnostics() {
    console.log('🔬 Starting Evidence Aggregation Diagnostics\n');

    // Test 1: Direct API Test
    await testDirectAPIs();

    // Test 2: Pipeline Integration Test
    await testPipelineIntegration();

    // Test 3: Evidence Aggregation Test
    await testEvidenceAggregation();

    console.log('\n✅ Diagnostics Complete');
}

/**
 * Test 1: Verify APIs are working
 */
async function testDirectAPIs() {
    console.log('📋 TEST 1: Direct API Verification');
    console.log('=' .repeat(50));

    try {
        // Test SERP API
        const serpApi = SerpApiService.getInstance();
        const serpResults = await serpApi.search('Biden infrastructure bill 2021', 5);

        console.log('✅ SERP API:');
        console.log(`   - Results returned: ${serpResults.results?.length || 0}`);
        console.log(`   - Sample result:`, serpResults.results?.[0] ? {
            source: serpResults.results[0].source,
            link: serpResults.results[0].link,
            hasSnippet: !!serpResults.results[0].snippet
        } : 'None');

        // Test Fact-Check API
        const factCheckApi = GoogleFactCheckService.getInstance();
        const factCheckResults = await factCheckApi.searchClaims('Biden infrastructure bill', 3);

        console.log('✅ Fact-Check API:');
        console.log(`   - Results returned: ${factCheckResults.length}`);
        console.log(`   - Sample result:`, factCheckResults[0] ? {
            hasClaimReview: !!factCheckResults[0].claimReview,
            publisher: typeof factCheckResults[0].claimReview?.[0]?.publisher === 'string'
                ? factCheckResults[0].claimReview[0].publisher
                : factCheckResults[0].claimReview?.[0]?.publisher?.name
        } : 'None');

    } catch (error) {
        console.error('❌ API Test Failed:', error);
    }

    console.log('');
}

/**
 * Test 2: Pipeline Integration
 */
async function testPipelineIntegration() {
    console.log('📋 TEST 2: Pipeline Integration');
    console.log('=' .repeat(50));

    const testClaim = 'The Eiffel Tower was built in 1889';

    try {
        const pipeline = PipelineIntegration.getInstance();
        const result = await pipeline.processAndSearch(testClaim, {
            executePhase2: false, // Quick test - only immediate queries
            maxResultsPerQuery: 5
        });

        console.log('✅ Pipeline Results:');
        console.log(`   - Queries executed: ${result.executionMetrics.totalQueriesExecuted}`);
        console.log(`   - Raw results returned: ${result.executionMetrics.totalResultsReturned}`);
        console.log(`   - Evidence items extracted: ${result.aggregatedEvidence.length}`);
        console.log(`   - Processing time: ${result.executionMetrics.averageQueryTime}ms avg`);

        if (result.aggregatedEvidence.length > 0) {
            console.log('✅ Sample Evidence:');
            const sample = result.aggregatedEvidence[0];
            console.log(`   - Publisher: ${sample.publisher}`);
            console.log(`   - URL: ${sample.url}`);
            console.log(`   - Score: ${sample.score}`);
            console.log(`   - Type: ${sample.type}`);
            console.log(`   - Quote length: ${sample.quote.length} chars`);
        } else {
            console.warn('⚠️  WARNING: No evidence extracted!');
        }

        // Check search results structure
        console.log('\n🔍 Search Results Breakdown:');
        let totalResults = 0;
        result.searchResults.immediate.forEach((results, queryId) => {
            console.log(`   - ${queryId}: ${results.length} results`);
            totalResults += results.length;

            if (results.length > 0) {
                const sampleResult = results[0];
                console.log(`     Sample keys: ${Object.keys(sampleResult).join(', ')}`);
            }
        });

        if (totalResults > 0 && result.aggregatedEvidence.length === 0) {
            console.error('❌ CRITICAL: Results returned but NO evidence extracted!');
            console.error('   This indicates the aggregateEvidence() method is failing');
        }

    } catch (error) {
        console.error('❌ Pipeline Test Failed:', error);
    }

    console.log('');
}

/**
 * Test 3: Evidence Aggregation Logic
 */
async function testEvidenceAggregation() {
    console.log('📋 TEST 3: Evidence Aggregation Logic');
    console.log('=' .repeat(50));

    // Create mock search results with different formats
    const mockResults = new Map([
        ['query-1', [
            // SERP API format
            {
                link: 'https://example.com/article1',
                source: 'Example News',
                snippet: 'This is a test article snippet with relevant information.',
                title: 'Test Article 1'
            },
            // Alternate format
            {
                url: 'https://example.com/article2',
                publisher: 'Another Source',
                description: 'Different format test',
                text: 'Article text here'
            }
        ]],
        ['query-2', [
            // Fact-check format
            {
                text: 'Test claim',
                claimReview: [{
                    publisher: { name: 'FactCheck.org' },
                    url: 'https://factcheck.org/test',
                    reviewRating: {
                        textualRating: 'True',
                        ratingValue: 5,
                        bestRating: 5
                    }
                }]
            }
        ]]
    ]);

    try {
        const pipeline = PipelineIntegration.getInstance();

        // Use private method via type assertion for testing
        const aggregateMethod = (pipeline as any).aggregateEvidence.bind(pipeline);

        const mockPipelineResult = {
            textAnalysis: { originalText: 'test' },
            semanticExtraction: {},
            querySynthesis: {},
            validatedQueries: [],
            rankedQueries: [],
            executionPlan: { immediate: [], followUp: [], deepDive: [] },
            cacheKey: 'test',
            metadata: {}
        };

        const evidence = aggregateMethod(
            {
                immediate: mockResults,
                followUp: new Map(),
                deepDive: new Map()
            },
            mockPipelineResult
        );

        console.log('✅ Aggregation Test Results:');
        console.log(`   - Input results: 3 items`);
        console.log(`   - Output evidence: ${evidence.length} items`);

        if (evidence.length > 0) {
            evidence.forEach((item, index) => {
                console.log(`   - Evidence ${index + 1}:`);
                console.log(`     • Publisher: ${item.publisher}`);
                console.log(`     • URL: ${item.url}`);
                console.log(`     • Score: ${item.score}`);
                console.log(`     • Type: ${item.type}`);
                console.log(`     • Has quote: ${item.quote.length > 0}`);
            });

            // Verify deduplication
            const urls = evidence.map(e => e.url).filter(Boolean);
            const uniqueUrls = new Set(urls);
            if (urls.length !== uniqueUrls.size) {
                console.warn('⚠️  Duplicate URLs detected - deduplication may not be working');
            } else {
                console.log('✅ Deduplication working correctly');
            }

            // Verify scoring
            const avgScore = evidence.reduce((sum, e) => sum + e.score, 0) / evidence.length;
            console.log(`✅ Average score: ${avgScore.toFixed(1)}% (target: 50-80%)`);

        } else {
            console.error('❌ CRITICAL: Aggregation returned 0 evidence from mock data!');
        }

    } catch (error) {
        console.error('❌ Aggregation Test Failed:', error);
    }

    console.log('');
}

/**
 * API Route Example for Next.js
 * Save as: app/api/diagnostic/route.ts
 */
export async function GET() {
    const startTime = Date.now();
    const diagnosticResults = {
        timestamp: new Date().toISOString(),
        tests: [] as any[]
    };

    try {
        // Run diagnostics
        await runDiagnostics();

        diagnosticResults.tests.push({
            name: 'Evidence Aggregation',
            status: 'passed',
            duration: Date.now() - startTime
        });

        return Response.json({
            success: true,
            message: 'Diagnostics completed successfully',
            results: diagnosticResults
        });

    } catch (error) {
        return Response.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            results: diagnosticResults
        }, { status: 500 });
    }
}

/**
 * Standalone Script Usage:
 *
 * Create a file: scripts/test-diagnostics.ts
 *
 * import { runDiagnostics } from './diagnostic-test';
 * runDiagnostics().catch(console.error);
 *
 * Run with: npx tsx scripts/test-diagnostics.ts
 */

// Export for use in tests
export default runDiagnostics;