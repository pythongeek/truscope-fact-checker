// src/components/EnhancedDashboard.tsx

import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { EvidenceItem } from '../types';
import { fetchAllEvidence } from '../services/evidenceService';
import { computeValidatedScore } from '../services/validator';
import { EvidenceList } from './EvidenceList';
import { ScoreBreakdown } from './ScoreBreakdown'; // Assuming this component can display a simple score

export const EnhancedDashboard: React.FC = () => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [validationScore, setValidationScore] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) {
      setError('Please enter a claim or topic to verify.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setEvidence([]);
    setValidationScore(0);

    try {
      const allEvidence = await fetchAllEvidence(query);
      const { finalScore, scoredEvidence } = computeValidatedScore(allEvidence);

      setEvidence(scoredEvidence);
      setValidationScore(finalScore);

    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold text-center text-gray-800">Fact-Checking & Editorial Assistant</h1>

      {/* Input Section */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter a claim, topic, or URL to analyze..."
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

      {error && <p className="text-red-500 text-center">{error}</p>}

      {/* Results Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white p-4 rounded-lg shadow">
          {isLoading ? (
            <div className="text-center py-8">Fetching and analyzing sources...</div>
          ) : (
            <EvidenceList evidence={evidence} />
          )}
        </div>
        <div className="md:col-span-1 bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">Validation Score</h3>
          {/* Using ScoreBreakdown or a simple display */}
          <ScoreBreakdown score={validationScore} />
          <div className="text-center text-6xl font-bold text-gray-800 mt-4">{validationScore}</div>
          <p className="text-center text-gray-500">out of 100</p>
        </div>
      </div>
    </div>
  );
};