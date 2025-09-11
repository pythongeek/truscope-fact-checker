import React, { useState, useCallback, useRef, useEffect } from 'react';
import Header from './components/Header';
import InputSection from './components/InputSection';
import Dashboard from './components/Dashboard';
import UsageStats from './components/UsageStats';
import { analyzeContent, getDailyUsage, DAILY_LIMIT } from './services/geminiService';
import type { AnalysisResult } from './types';

const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW || '60000', 10);
const MAX_REQUESTS_PER_WINDOW = parseInt(process.env.MAX_REQUESTS_PER_WINDOW || '3', 10);

const App: React.FC = () => {
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [inputText, setInputText] = useState<string>('');
  const [requestTimes, setRequestTimes] = useState<number[]>([]);
  const lastRequestRef = useRef<number>(0);
  const [dailyUsage, setDailyUsage] = useState<number>(0);

  useEffect(() => {
    setDailyUsage(getDailyUsage());
  }, []);

  const checkRateLimit = useCallback((): boolean => {
    const now = Date.now();

    // Check if minimum time between requests has passed (e.g., 10 seconds)
    if (now - lastRequestRef.current < 10000) {
      setError('Please wait at least 10 seconds between requests.');
      return false;
    }

    // Filter recent requests within the time window
    const recentRequests = requestTimes.filter(
      time => now - time < RATE_LIMIT_WINDOW
    );

    if (recentRequests.length >= MAX_REQUESTS_PER_WINDOW) {
      setError(`Rate limit exceeded. You can make ${MAX_REQUESTS_PER_WINDOW} requests per minute.`);
      return false;
    }

    return true;
  }, [requestTimes]);

  const handleAnalyze = useCallback(async () => {
    if (!checkRateLimit()) {
      return;
    }

    if (!inputText.trim()) {
      setError('Please enter some text to analyze.');
      return;
    }

    const now = Date.now();
    setRequestTimes(prev => [...prev.filter(time => now - time < RATE_LIMIT_WINDOW), now]);
    lastRequestRef.current = now;

    setIsLoading(true);
    setError(null);
    setAnalysisResult(null);
    try {
      const result = await analyzeContent(inputText);
      setAnalysisResult(result);
      setDailyUsage(getDailyUsage()); // Update usage after successful analysis
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      setAnalysisResult(null);
    } finally {
      setIsLoading(false);
    }
  }, [inputText, checkRateLimit]);

  return (
    <div className="min-h-screen bg-slate-900 font-sans text-slate-200">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <UsageStats dailyUsage={dailyUsage} dailyLimit={DAILY_LIMIT} />
          <InputSection
            inputText={inputText}
            setInputText={setInputText}
            onAnalyze={handleAnalyze}
            isLoading={isLoading}
          />

          {error && (
            <div className="mt-6 bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg animate-fade-in" role="alert">
              <p className="font-bold">Error</p>
              <p>{error}</p>
            </div>
          )}

          {(isLoading || analysisResult) && !error && (
            <div className="mt-8">
              <Dashboard result={analysisResult} isLoading={isLoading} />
            </div>
          )}

        </div>
      </main>
      <footer className="text-center py-4 text-slate-500 text-sm">
        <p>Created By Ni-On, Powered by Google Gemini</p>
      </footer>
    </div>
  );
};

export default App;