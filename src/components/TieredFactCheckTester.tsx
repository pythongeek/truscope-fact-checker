import React, { useState } from 'react';
import { TieredFactCheckService } from '../services/tieredFactCheckService';
import { FactCheckReport } from '../types/factCheck';

export const TieredFactCheckTester: React.FC = () => {
  const [testClaim, setTestClaim] = useState('');
  const [result, setResult] = useState<FactCheckReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tieredService = TieredFactCheckService.getInstance();

  const runTest = async () => {
    if (!testClaim.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const report = await tieredService.performTieredCheck(testClaim);
      setResult(report);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Tiered Fact Check Tester</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Test Claim
          </label>
          <input
            type="text"
            value={testClaim}
            onChange={(e) => setTestClaim(e.target.value)}
            placeholder="Enter a claim to test..."
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <button
          onClick={runTest}
          disabled={loading || !testClaim.trim()}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Testing...' : 'Run Tiered Check'}
        </button>
      </div>

      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 font-medium">Error:</p>
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {result && (
        <div className="mt-6 space-y-4">
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <h3 className="text-lg font-semibold text-green-800">Result</h3>
            <p><strong>Verdict:</strong> {result.final_verdict}</p>
            <p><strong>Score:</strong> {result.final_score}%</p>
            <p><strong>Processing Time:</strong> {result.metadata.processing_time_ms}ms</p>
            <p><strong>Evidence Count:</strong> {result.evidence.length}</p>
          </div>

          {result.metadata.tier_breakdown && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-semibold text-blue-800 mb-2">Tier Breakdown</h4>
              {result.metadata.tier_breakdown.map((tier, index) => (
                <div key={index} className="mb-2 p-2 bg-white rounded border">
                  <p><strong>Phase {index + 1}:</strong> {tier.tier}</p>
                  <p>Success: {tier.success ? '✅' : '❌'} |
                     Confidence: {tier.confidence}% |
                     Time: {tier.processing_time_ms}ms |
                     Evidence: {tier.evidence_count}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};