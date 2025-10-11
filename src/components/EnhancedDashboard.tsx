// src/components/EnhancedDashboard.tsx
// (Updated to include Editor and Schema Generation)

import React, { useState } from 'react';
import { Search, FileText } from 'lucide-react';
import { EvidenceItem, TieredFactCheckResult } from '@/types';
import { fetchAllEvidence } from '../services/evidenceService';
import { computeValidatedScore } from '../services/validator';
import { schemaGenerator } from '../services/schemaGenerator';
import { EvidenceList } from './EvidenceList';
import { SchemaModal } from './SchemaModal';
import { FactCheckAssistant } from './FactCheckAssistant';
import { EnhancedFactCheckReport } from './EnhancedFactCheckReport';

export const EnhancedDashboard: React.FC = () => {
  const [query, setQuery] = useState('');
  const [articleText, setArticleText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [validationScore, setValidationScore] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showSchema, setShowSchema] = useState(false);
  const [generatedSchema, setGeneratedSchema] = useState<object | null>(null);
  const [factCheckResult, setFactCheckResult] = useState<TieredFactCheckResult | null>(null);

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

    // Create a mock TieredFactCheckResult
    const result: TieredFactCheckResult = {
      report: {
        id: '1',
        originalText: query,
        summary: `Based on the analysis, the claim "${query}" has a validation score of ${finalScore}.`,
        overallAuthenticityScore: finalScore,
        claimVerifications: scoredEvidence.map((item) => ({
          claimText: query,
          status: item.score > 70 ? 'Verified' : 'Unverified',
          confidenceScore: item.score / 100,
          explanation: item.snippet,
        })),
        evidence: scoredEvidence,
        final_score: finalScore,
        final_verdict: 'Uncertain',
        reasoning: '',
        score_breakdown: {}
      },
      metadata: {}
    };
    setFactCheckResult(result);
    setIsLoading(false);
  };

  const handleGenerateSchema = () => {
    if (!factCheckResult) {
        alert("Please run an analysis first to generate evidence.");
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

      {/* Conditionally render the assistant */}
      {factCheckResult && (
        <>
          <EnhancedFactCheckReport report={factCheckResult} />
          <FactCheckAssistant report={factCheckResult} />
        </>
      )}
    </div>
  );
};