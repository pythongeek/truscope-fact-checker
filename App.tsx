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

const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 5; // 5 requests per minute

/**
 * The main application component. It orchestrates the entire user interface,
 * manages application state, and handles interactions between various sub-components.
 *
 * @returns {JSX.Element} The rendered App component.
 */
const App: React.FC = () => {
  // State for the main analysis result
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  // State for the extracted claims result
  const [claimAnalysisResult, setClaimAnalysisResult] = useState<Claim[] | null>(null);
  // Loading state for the main analysis
  const [isLoading, setIsLoading] = useState<boolean>(false);
  // Loading state for claim extraction
  const [isExtractingClaims, setIsExtractingClaims] = useState<boolean>(false);
  // General error message state
  const [error, setError] = useState<string | null>(null);
  // The user's input text
  const [inputText, setInputText] = useState<string>('');
  // Timestamps of recent requests for rate limiting
  const [requestTimes, setRequestTimes] = useState<number[]>([]);
  const lastRequestRef = useRef<number>(0);
  // Daily usage count for the shared API key
  const [dailyUsage, setDailyUsage] = useState<number>(0);
  // Visibility state for the API key modal
  const [showApiKeyModal, setShowApiKeyModal] = useState<boolean>(false);
  // State to track if the user has set their own API key
  const [hasUserApiKey, setHasUserApiKey] = useState<boolean>(false);
  // Visibility state for the verification dashboard
  const [showVerificationDashboard, setShowVerificationDashboard] = useState<boolean>(false);
  // State to hold the results of the verification process
  const [verificationResults, setVerificationResults] = useState<VerificationResult[]>([]);

  useEffect(() => {
    setDailyUsage(getDailyUsage());
    const userApiKey = localStorage.getItem('gemini_api_key');
    setHasUserApiKey(!!userApiKey);
  }, []);

  /**
   * A callback function that checks if the user has exceeded the request rate limit.
   * It prevents spamming the API by enforcing a maximum number of requests per minute.
   *
   * @returns {boolean} True if the request is allowed, false otherwise.
   */
  const checkRateLimit = useCallback((): boolean => {
    const now = Date.now();
    if (now - lastRequestRef.current < 10000) { // 10-second cool-down
      setError('Please wait at least 10 seconds between requests.');
      return false;
    }
    const recentRequests = requestTimes.filter(time => now - time < RATE_LIMIT_WINDOW);
    if (recentRequests.length >= MAX_REQUESTS_PER_WINDOW) {
      setError(`Rate limit exceeded. You can make ${MAX_REQUESTS_PER_WINDOW} requests per minute.`);
      return false;
    }
    return true;
  }, [requestTimes]);

  /**
   * A callback function to handle the main "Analyze" action.
   * It performs rate limiting and input validation before calling the analysis service.
   */
  const handleAnalyze = useCallback(async () => {
    if (!checkRateLimit()) return;
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
      setDailyUsage(getDailyUsage());
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

  /**
   * A callback function to handle the "Extract Claims" action.
   * It performs rate limiting and input validation before calling the claim extraction service.
   */
  const handleExtractClaims = useCallback(async () => {
    if (!checkRateLimit()) return;
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

  /**
   * A callback function that saves a new API key to local storage and updates the app state.
   * @param {string} apiKey - The API key to save.
   */
  const handleApiKeySaved = (apiKey: string) => {
    localStorage.setItem('gemini_api_key', apiKey);
    setHasUserApiKey(true);
    setShowApiKeyModal(false);
    setError(null);
  };

  /**
   * A callback function that removes the user's API key from local storage.
   */
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