import React, { useState } from 'react';
import { Search, FileText } from 'lucide-react';
import { Evidence, FactCheckReport } from '@/types';
import { fetchAllEvidence } from '../services/evidenceService';
import { computeValidatedScore } from '../services/validator';
import { schemaGenerator } from '../services/schemaGenerator';
import { EvidenceList } from './EvidenceList';
import { SchemaModal } from './SchemaModal';
import { EnhancedFactCheckReport } from './EnhancedFactCheckReport';
import { useAppState } from '../contexts/AppStateContext';

export const EnhancedDashboard: React.FC = () => {
    const [query, setQuery] = useState('');
    const [articleText, setArticleText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [evidence, setEvidence] = useState<Evidence[]>([]);
    const [validationScore, setValidationScore] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [showSchema, setShowSchema] = useState(false);
    const [generatedSchema, setGeneratedSchema] = useState<object | null>(null);
    const [factCheckResult, setFactCheckResult] = useState<FactCheckReport | null>(null);
    
    // Use the AppStateContext to control the assistant
    const { setCurrentReport } = useAppState();

    const handleSearch = async () => {
        if (!query.trim()) {
            setError('Please enter a claim or topic to verify.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setFactCheckResult(null);

        const allEvidence = await fetchAllEvidence(query);
        const { finalScore, scoredEvidence } = computeValidatedScore(allEvidence);
        setEvidence(scoredEvidence);
        setValidationScore(finalScore);

        // Create a result object that conforms to the FactCheckReport type
        const result: FactCheckReport = {
            id: new Date().toISOString(),
            originalText: query,
            summary: `Based on a preliminary analysis, the claim "${query}" has a validation score of ${finalScore}.`,
            reasoning: 'This is a mock result based on automated evidence scoring.',
            evidence: scoredEvidence,
            finalScore: finalScore,
            finalVerdict: 'Needs Context',
            // Corrected: Ensure claimVerifications is always an array
            claimVerifications: scoredEvidence.map((item) => ({
                id: item.id,
                claimText: query,
                status: item.relevanceScore > 0.7 ? 'Verified' : 'Disputed',
                confidenceScore: item.credibilityScore / 100,
                explanation: item.snippet,
                evidence: [item],
            })),
            scoreBreakdown: {
                finalScoreFormula: 'Weighted average of credibility and relevance.',
                metrics: [
                    { name: 'Average Credibility', score: 80, weight: 0.6, description: 'Source credibility score', reasoning: 'Based on known reliable sources.' },
                    { name: 'Relevance Match', score: 75, weight: 0.4, description: 'How relevant sources are to the claim', reasoning: 'Based on semantic matching.' }
                ],
            },
            metadata: {
                methodUsed: 'Automated Mock Analysis',
                processingTimeMs: 500,
                sourcesConsulted: {
                    total: scoredEvidence.length,
                    highCredibility: scoredEvidence.filter(e => e.credibilityScore > 75).length,
                    conflicting: 0,
                },
                warnings: ['This is not a final fact-check report.'],
            },
        };
        
        setFactCheckResult(result);
        // This will now trigger Verity to open with the report
        setCurrentReport(result);
        
        setIsLoading(false);
    };

    const handleGenerateSchema = () => {
        if (!factCheckResult) {
            alert("Please run an analysis first to generate a report.");
            return;
        }
        const schema = schemaGenerator.generate(factCheckResult);
        setGeneratedSchema(schema);
        setShowSchema(true);
    };

    return (
        <div className="max-w-6xl mx-auto p-4 space-y-6">
            <h1 className="text-3xl font-bold text-center text-gray-800">TruScope: Production Dashboard</h1>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Side: Editor and Controls */}
                <div className="bg-white p-4 rounded-lg shadow space-y-4">
                    <h2 className="text-xl font-semibold">Content Editor</h2>
                    <textarea
                        value={articleText}
                        onChange={(e) => setArticleText(e.target.value)}
                        placeholder="Paste your article content here to get auto-correction suggestions..."
                        className="w-full h-64 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="relative">
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Enter the primary claim to fact-check..."
                            className="w-full p-3 pr-20 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            disabled={isLoading}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        />
                        <button
                            onClick={handleSearch}
                            disabled={isLoading}
                            className="absolute right-2 top-1/2 -translate-y-1/2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                        >
                            {isLoading ? 'Analyzing...' : <Search className="w-5 h-5" />}
                        </button>
                    </div>
                    <button
                        onClick={handleGenerateSchema}
                        disabled={isLoading || evidence.length === 0}
                        className="w-full bg-green-600 text-white p-3 rounded-lg hover:bg-green-700 flex items-center justify-center disabled:bg-gray-400"
                    >
                        <FileText size={18} className="mr-2" />
                        Generate Fact-Check Report (JSON-LD)
                    </button>
                </div>

                {/* Right Side: Results */}
                <div className="space-y-6">
                    <div className="bg-white p-4 rounded-lg shadow">
                        <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">Validation Score</h3>
                        <div className="text-center text-6xl font-bold text-gray-800">{validationScore}</div>
                        <p className="text-center text-gray-500">out of 100</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow max-h-[60vh] overflow-y-auto">
                        {isLoading ? (
                            <div className="text-center py-8">Fetching and analyzing sources...</div>
                        ) : (
                            <EvidenceList evidence={evidence} />
                        )}
                    </div>
                </div>
            </div>

            {showSchema && generatedSchema && (
                <SchemaModal schema={generatedSchema} onClose={() => setShowSchema(false)} />
            )}

            {/* The report is now displayed, and the assistant is handled by App.tsx */}
            {factCheckResult && (
                <EnhancedFactCheckReport report={factCheckResult} />
            )}
        </div>
    );
};
