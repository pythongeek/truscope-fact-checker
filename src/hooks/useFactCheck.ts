import React, { useState } from 'react';
import { EnhancedFactCheckOrchestrator } from '../services/EnhancedFactCheckOrchestrator';
import { FactCheckEvidence } from '../lib/fact-check-enhanced';

export function useFactCheck() {
  const [orchestrator] = useState(
    () => new EnhancedFactCheckOrchestrator()
  );

  const [evidence, setEvidence] = useState<FactCheckEvidence | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const performCheck = async (text: string) => {
    setLoading(true);
    setError(null);

    try {
      const result = await orchestrator.performFactCheck(text);
      setEvidence(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      console.error('Fact check error:', err);
    } finally {
      setLoading(false);
    }
  };

  return { evidence, loading, error, performCheck, orchestrator };
}
