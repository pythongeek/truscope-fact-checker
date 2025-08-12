import { useState, useCallback, useEffect } from 'react';
import { Header } from './components/Header';
import { InputSection } from './components/InputSection';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ResultsDashboard } from './components/ResultsDashboard';
import { performDeepAnalysis } from './services/geminiService';
import type { AnalysisResult } from './types';

const SAMPLE_ARTICLE = `Breaking: New Study Reveals Shocking Truth About Coffee Consumption

A groundbreaking study conducted by researchers at Stanford University has revealed that drinking more than 5 cups of coffee per day can increase productivity by 300%. According to Dr. Smith, the lead researcher, "Our findings show definitively that coffee is a miracle drink that can solve all workplace problems."

The study, which surveyed 100 participants over two weeks, found that everyone who drank excessive amounts of coffee reported feeling more energetic. Some participants claimed they could work 20 hours a day without feeling tired.

"This changes everything we thought we knew about caffeine," said Dr. Smith. The research, funded by a major coffee company, suggests that all employees should drink at least 6 cups of coffee daily.

Industry experts are calling this the most important discovery of the century, though some scientists question the methodology used in the study.`;


export default function App() {
  const [articleText, setArticleText] = useState<string>('');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleAnalysis = useCallback(async () => {
    if (!articleText || articleText.length < 100) {
      setError('Please enter an article with at least 100 characters for a meaningful analysis.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setAnalysisResult(null);

    try {
      setLoadingMessage('Initializing AI analysis...');
      await new Promise(res => setTimeout(res, 300));
      
      setLoadingMessage('Extracting claims & verifying with Google Search...');
      await new Promise(res => setTimeout(res, 500));
      
      setLoadingMessage('Performing deep semantic analysis...');
      await new Promise(res => setTimeout(res, 500));

      setLoadingMessage('Generating enhanced article & fact-check schema...');
      const result = await performDeepAnalysis(articleText);
      
      setLoadingMessage('Finalizing report...');
      await new Promise(res => setTimeout(res, 500));

      setAnalysisResult(result);
    } catch (err) {
      console.error('Analysis failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred during analysis.';
      setError(`Analysis Failed: ${errorMessage}. This can happen due to high demand or an invalid API key. Please check the console and try again later.`);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [articleText]);

  const handleClear = useCallback(() => {
    setArticleText('');
    setAnalysisResult(null);
    setError(null);
    setIsLoading(false);
  }, []);

  const handleLoadSample = useCallback(() => {
    setArticleText(SAMPLE_ARTICLE);
    setAnalysisResult(null);
    setError(null);
  }, []);

   useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            if (!isLoading) {
                handleAnalysis();
            }
        }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
        window.removeEventListener('keydown', handleKeyDown);
    };
}, [handleAnalysis, isLoading]);

  return (
    <div className="min-h-screen text-gray-800 bg-gray-50">
      <div className="container mx-auto max-w-7xl px-4 py-8 sm:py-12">
        <Header />
        <main>
          <div className="animate-entry fade-in-up">
            <InputSection
              articleText={articleText}
              onArticleChange={setArticleText}
              onAnalyze={handleAnalysis}
              onClear={handleClear}
              onLoadSample={handleLoadSample}
              isLoading={isLoading}
            />
          </div>
          {isLoading && (
            <div className="animate-entry fade-in">
              <LoadingSpinner message={loadingMessage} />
            </div>
           )}
          {error && (
            <div className="mt-8 bg-red-100 border-l-4 border-red-500 text-red-800 p-6 rounded-r-lg shadow-md animate-entry fade-in" role="alert">
              <h3 className="font-bold text-lg">Error</h3>
              <p>{error}</p>
            </div>
          )}
          {analysisResult && !isLoading && (
            <div className="mt-8 animate-entry fade-in-up">
              <ResultsDashboard result={analysisResult} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
