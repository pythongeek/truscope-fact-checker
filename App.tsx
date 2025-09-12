import React, { useState, useCallback, useRef, useEffect } from 'react';
import Header from './components/Header';
import InputSection from './components/InputSection';
import Dashboard from './components/Dashboard';
import UsageStats from './components/UsageStats';
import ApiKeyModal from './components/ApiKeyModal';
import { analyzeContent, getDailyUsage, DAILY_LIMIT } from './services/geminiService';
import { extractClaims } from './services/claimExtractor';
import type { AnalysisResult } from './types';
import type { Claim } from './types/claim';
import ClaimDelineation from './components/ClaimDelineation';
import VerificationDashboard from './components/verification/VerificationDashboard';
import type { VerificationResult } from './types/verification';

const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW || '60000', 10);
const MAX_REQUESTS_PER_WINDOW = parseInt(process.env.MAX_REQUESTS_PER_WINDOW || '3', 10);

const App: React.FC = () => {
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [claimAnalysisResult, setClaimAnalysisResult] = useState<Claim[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isExtractingClaims, setIsExtractingClaims] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [inputText, setInputText] = useState<string>('');
  const [requestTimes, setRequestTimes] = useState<number[]>([]);
  const lastRequestRef = useRef<number>(0);
  const [dailyUsage, setDailyUsage] = useState<number>(0);
  const [showApiKeyModal, setShowApiKeyModal] = useState<boolean>(false);
  const [hasUserApiKey, setHasUserApiKey] = useState<boolean>(false);
  const [showVerificationDashboard, setShowVerificationDashboard] = useState<boolean>(false);
  const [verificationResults, setVerificationResults] = useState<VerificationResult[]>([]);

  useEffect(() => {
    setDailyUsage(getDailyUsage());
    // Check if user has set their own API key
    const userApiKey = localStorage.getItem('gemini_api_key');
    setHasUserApiKey(!!userApiKey);
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
      if (err instanceof Error && err.message.includes('API key')) {
        setShowApiKeyModal(true);
      }
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      setAnalysisResult(null);
    } finally {
      setIsLoading(false);
    }
  }, [inputText, checkRateLimit]);

  const handleExtractClaims = useCallback(async () => {
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

    setIsExtractingClaims(true);
    setError(null);
    setClaimAnalysisResult(null);
    try {
      const result = await extractClaims(inputText);
      setClaimAnalysisResult(result.claims);
    } catch (err) {
      if (err instanceof Error && err.message.includes('API key')) {
        setShowApiKeyModal(true);
      }
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      setClaimAnalysisResult(null);
    } finally {
      setIsExtractingClaims(false);
    }
  }, [inputText, checkRateLimit]);

  const handleApiKeySaved = (apiKey: string) => {
    localStorage.setItem('gemini_api_key', apiKey);
    setHasUserApiKey(true);
    setShowApiKeyModal(false);
    setError(null);
  };

  const handleClearApiKey = () => {
    localStorage.removeItem('gemini_api_key');
    setHasUserApiKey(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 font-sans text-slate-200">
      <Header onApiKeyClick={() => setShowApiKeyModal(true)} hasUserApiKey={hasUserApiKey} />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <UsageStats
            dailyUsage={dailyUsage}
            dailyLimit={DAILY_LIMIT}
            usingUserApiKey={hasUserApiKey}
          />
          <InputSection
            inputText={inputText}
            setInputText={setInputText}
            onAnalyze={handleAnalyze}
            isLoading={isLoading}
            onExtractClaims={handleExtractClaims}
            isExtractingClaims={isExtractingClaims}
          />

          {!hasUserApiKey && (
            <div className="mt-4 bg-amber-900/30 border border-amber-600/50 text-amber-200 px-4 py-3 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">Using Shared API Key</p>
                  <p className="text-sm">Limited to {DAILY_LIMIT} requests per day. Add your own API key for unlimited usage.</p>
                </div>
                <button
                  onClick={() => setShowApiKeyModal(true)}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors text-sm font-medium"
                >
                  Add API Key
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-6 bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg animate-fade-in" role="alert">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold">Error</p>
                  <p>{error}</p>
                </div>
                {error.includes('API key') && (
                  <button
                    onClick={() => setShowApiKeyModal(true)}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-medium"
                  >
                    Set API Key
                  </button>
                )}
              </div>
            </div>
          )}

          {(isLoading || analysisResult) && !error && (
            <div className="mt-8">
              <Dashboard result={analysisResult} isLoading={isLoading} />
            </div>
          )}

          {(isExtractingClaims || claimAnalysisResult) && !error && (
            <div className="mt-8">
              <ClaimDelineation claims={claimAnalysisResult} isLoading={isExtractingClaims} />
            </div>
          )}

          {claimAnalysisResult && claimAnalysisResult.length > 0 && (
            <div className="mt-8 text-center">
              <button
                onClick={() => setShowVerificationDashboard(!showVerificationDashboard)}
                className="px-6 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 disabled:bg-slate-600 transition-all duration-300 shadow-md hover:shadow-lg"
              >
                {showVerificationDashboard ? 'Hide' : 'Show'} Verification Dashboard
              </button>
            </div>
          )}

          {showVerificationDashboard && claimAnalysisResult && (
            <div className="mt-8">
              <VerificationDashboard
                claims={claimAnalysisResult.filter(c => c.isVerifiable).map(c => c.text)}
                onVerificationComplete={setVerificationResults}
              />
            </div>
          )}
        </div>
      </main>

      <ApiKeyModal
        isOpen={showApiKeyModal}
        onClose={() => setShowApiKeyModal(false)}
        onSave={handleApiKeySaved}
        onClear={handleClearApiKey}
        hasExistingKey={hasUserApiKey}
      />

      <footer className="text-center py-4 text-slate-500 text-sm">
        <p>Created By Ni-On, Powered by Google Gemini</p>
      </footer>
    </div>
  );
};

export default App;