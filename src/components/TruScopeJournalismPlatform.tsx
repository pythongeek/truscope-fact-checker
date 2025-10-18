// src/components/TruScopeJournalismPlatform.tsx - COMPLETE VERSION
import React, { useState, useEffect } from 'react';
import { getApiKeys, saveApiKeys } from '../services/apiKeyService';
import { GoogleFactCheckService } from '../services/googleFactCheckService';
import { ApiKeys, FactCheckReport } from '@/types';
import Sidebar from './Sidebar';
import SchemaInputForm from './SchemaInputForm';
import {
  FileText, CheckCircle, AlertTriangle, Link as LinkIcon,
  Download, Copy, Check, X, Search, Edit3, BookOpen, Globe,
  Award, Shield, ExternalLink, Info, RefreshCw, Database
} from 'lucide-react';
import HistoryView from './HistoryView';
import TrendingMisinformation from './TrendingMisinformation';
import SettingsModal from './SettingsModal';
import { useAppState } from '../contexts/AppStateContext';

const formatCitation = (source: any, style: string = 'ap', num?: number) => {
    const publisher = source.publisher || 'Unknown';
    const date = source.publishedDate || new Date().toISOString().split('T')[0];
    const url = source.url || '';

    if (style === 'ap') {
        return `According to ${publisher} (${date})${url ? `. Available at: ${url}`: ''}`;
    } else if (style === 'apa') {
        return `${publisher}. (${new Date(date).getFullYear()}). ${url}`;
    }
    return `${publisher}, ${date}`;
};

export default function TruScopeJournalismPlatform() {
    const { setCurrentReport } = useAppState();

    const [activeTab, setActiveTab] = useState<'analyze' | 'report' | 'edit'>('analyze');
    const [content, setContent] = useState('');
    const [publishingContext, setPublishingContext] = useState('journalism');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [factCheckResult, setFactCheckResult] = useState<FactCheckReport | null>(null);
    const [editorResult, setEditorResult] = useState<any>(null);
    const [currentView, setCurrentView] = useState<'checker' | 'history' | 'trending'>('checker');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [apiStatus, setApiStatus] = useState<'checking' | 'available' | 'unavailable'>('checking');
    const [showSchemaInputModal, setShowSchemaInputModal] = useState(false);
    const [showSchemaModal, setShowSchemaModal] = useState(false);
    const [schemaData, setSchemaData] = useState<any>(null);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [analysisError, setAnalysisError] = useState<string | null>(null);

    const [settings, setSettings] = useState<{ apiKeys: ApiKeys }>({ apiKeys: {} });

    const handleNavigate = (view: 'checker' | 'history' | 'trending') => {
        setCurrentView(view);
    };

    useEffect(() => {
        console.log('🚀 Initializing TruScope Professional...');
        const keys = getApiKeys();
        setSettings({ apiKeys: keys });

        console.log('✅ TruScope initialized - All AI processing via Vertex AI');
        checkAPIAvailability();
    }, []);

    const handleSettingsSave = (newKeys: any) => {
        console.log('💾 Saving API keys...');
        saveApiKeys(newKeys);
        setSettings({ apiKeys: newKeys });
        setIsSettingsModalOpen(false);
    };

    const checkAPIAvailability = async () => {
        setApiStatus('checking');
        try {
            const response = await fetch('/api/health-check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (!response.ok) {
                setApiStatus('unavailable');
                return;
            }

            const data = await response.json();
            
            // Check if server-side APIs are configured
            const hasServerAPIs = data.apis?.serp && data.apis?.webz;
            
            setApiStatus(hasServerAPIs ? 'available' : 'unavailable');
            
            if (!hasServerAPIs) {
                console.warn('⚠️ Server-side APIs not fully configured');
            }
        } catch (error) {
            console.error('❌ Health check failed:', error);
            setApiStatus('unavailable');
        }
    };

    const handleAnalyze = async () => {
        if (!content.trim()) {
            alert('⚠️ Please enter content to analyze');
            return;
        }

        // Check if server APIs are available
        if (apiStatus === 'unavailable') {
            alert('⚠️ Server APIs are not configured. Please contact your administrator to set up SERP_API_KEY and NEWSAPI_API_KEY in the deployment environment.');
            return;
        }

        setIsAnalyzing(true);
        setActiveTab('analyze');
        setAnalysisError(null);

        console.log('🚀 Starting fact-check analysis via Vertex AI');
        console.log('📝 Content length:', content.length, 'characters');
        console.log('📋 Publishing context:', publishingContext);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

        try {
            console.log('🔑 Using Vertex AI for all AI processing (server-side)');

            let clientSideResults: { phase1?: any } = {};
            
            // Optional: Run Google Fact Check if available
            const apiKeys = getApiKeys();
            if (apiKeys.factCheck) {
                console.log('🔍 Running client-side Google Fact Check...');
                try {
                    const googleFactCheck = new GoogleFactCheckService();
                    const phase1Report = await googleFactCheck.searchClaims(content, 5);
                    if (phase1Report) {
                        console.log('✅ Client-side Google Fact Check complete:', phase1Report);
                        clientSideResults.phase1 = {
                            tier: 'direct-verification',
                            success: true,
                            confidence: phase1Report.finalScore,
                            evidence: phase1Report.evidence,
                            processingTime: phase1Report.metadata?.processingTimeMs || 0,
                        };
                    }
                } catch (error) {
                    console.warn('⚠️ Google Fact Check failed, continuing without it:', error);
                }
            }

            const requestBody = {
                text: content,
                publishingContext,
                clientSideResults,
                // No API keys needed - all handled server-side now
                config: {}
            };

            console.log('📤 Sending request to /api/fact-check (Vertex AI backend)');
            const response = await fetch('/api/fact-check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            console.log('📥 Response status:', response.status);

            if (!response.ok) {
                let errorMessage = `Server error: ${response.status}`;
                try {
                    const errorText = await response.text();
                    console.error('❌ Error response body:', errorText);
                    let errorData;
                    try {
                        errorData = JSON.parse(errorText);
                        errorMessage = errorData.error || errorData.details || errorMessage;
                    } catch {
                        errorMessage = errorText.substring(0, 200) || errorMessage;
                    }
                } catch (e) {
                    console.error('❌ Could not read error response');
                }
                throw new Error(errorMessage);
            }

            const result = await response.json();
            console.log('📦 Received result:', result);

            const normalizedResult = {
                ...result,
                final_score: result.finalScore || result.final_score || 0,
                final_verdict: result.finalVerdict || result.final_verdict || 'UNVERIFIED',
                finalScore: result.finalScore || result.final_score || 0,
                finalVerdict: result.finalVerdict || result.final_verdict || 'UNVERIFIED',
            };

            console.log('✅ Fact-check completed successfully');
            console.log('📊 Final Score:', normalizedResult.finalScore);
            console.log('⚖️ Verdict:', normalizedResult.finalVerdict);
            console.log('📋 Evidence Sources:', normalizedResult.evidence?.length || 0);
            console.log('⏱️ Processing Time:', normalizedResult.metadata?.processingTimeMs, 'ms');

            if (normalizedResult.metadata?.tierBreakdown) {
                console.log('🎯 Verification Tiers:');
                normalizedResult.metadata.tierBreakdown.forEach((tier: any) => {
                    console.log(`  - ${tier.tier}: ${tier.success ? '✓' : '→'} (${tier.confidence.toFixed(1)}%)`);
                });
            }

            if (normalizedResult.finalScore < 50) {
                console.warn('⚠️ Low confidence result:', normalizedResult.finalScore);
            }

            setFactCheckResult(normalizedResult);
            setCurrentReport(normalizedResult, content);
            setActiveTab('report');

        } catch (error: any) {
            clearTimeout(timeoutId);
            console.error('❌ Analysis failed:', error);
            let errorMessage = 'An unexpected error occurred';
            
            if (error.name === 'AbortError') {
                errorMessage = 'Request timeout - The analysis is taking longer than expected. Please try with shorter content or check the server logs.';
            } else if (error.message?.includes('authenticate')) {
                errorMessage = 'Authentication failed with Google Cloud. Please check that GCLOUD_SERVICE_ACCOUNT_KEY_JSON is properly configured in Vercel environment variables.';
            } else if (error.message?.includes('quota')) {
                errorMessage = 'API quota exceeded. Please check your Google Cloud billing and quotas.';
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            setAnalysisError(errorMessage);
            
            alert(`❌ Analysis failed:\n\n${errorMessage}\n\nPlease check:\n• Server environment variables are configured\n• Google Cloud credentials are valid\n• Internet connection is stable\n• Server logs for more details`);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleAutoCorrect = async (mode: string) => {
        if (!factCheckResult) return;

        setIsAnalyzing(true);
        console.log('🔧 Starting auto-correction via Vertex AI...');
        try {
            const response = await fetch('/api/auto-correct', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: content,
                    factCheckResult: factCheckResult,
                    mode: mode,
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Auto-correction failed');
            }
            
            const result = await response.json();
            setEditorResult(result);
            setActiveTab('edit');
            console.log('✅ Auto-correction completed');
        } catch (error: any) {
            console.error('❌ Auto-correction failed:', error);
            alert(`Auto-correction failed: ${error.message}\n\nThis feature requires Vertex AI to be properly configured.`);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleShowSchemaInput = () => setShowSchemaInputModal(true);

    const handleGenerateSchema = async (formData: any) => {
        if (!factCheckResult) return;
        try {
            const response = await fetch('/api/generate-schema', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            if (!response.ok) throw new Error('Schema generation failed');
            const data = await response.json();
            setSchemaData(data);
            setShowSchemaInputModal(false);
            setShowSchemaModal(true);
        } catch (error: any) {
            alert(`Schema generation failed: ${error.message}`);
        }
    };

    const handleSelectReport = (report: FactCheckReport, claimText: string) => {
        setFactCheckResult(report);
        setCurrentReport(report, claimText);
        setContent(claimText);
        setActiveTab('report');
        setCurrentView('checker');
    };

    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          currentView={currentView}
          onNavigate={handleNavigate}
          onSettingsClick={() => setIsSettingsModalOpen(true)}
        />
  
        <div className="flex-1 flex flex-col">
          <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
            <div className="max-w-7xl mx-auto px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <button
                    type="button"
                    className="md:hidden text-gray-500 hover:text-gray-700"
                    onClick={() => setIsSidebarOpen(true)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
                    <CheckCircle className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">TruScope Professional</h1>
                    <p className="text-sm text-gray-600">Enterprise Fact-Checking powered by Vertex AI</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className={`px-4 py-2 rounded-lg text-sm font-medium ${
                    apiStatus === 'available'
                      ? 'bg-green-100 text-green-700'
                      : apiStatus === 'unavailable'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {apiStatus === 'checking' && '🔄 Checking...'}
                    {apiStatus === 'available' && '✅ APIs Ready'}
                    {apiStatus === 'unavailable' && '⚠️ Setup Required'}
                  </div>
                  <span className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-sm font-semibold shadow-lg">
                    Vertex AI
                  </span>
                </div>
              </div>
            </div>
          </header>
  
          <main className="flex-1 overflow-y-auto p-8">
            {analysisError && (
              <div className="mb-6 p-4 bg-red-50 border-2 border-red-300 rounded-lg">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-red-900 mb-1">Analysis Error</h3>
                    <p className="text-sm text-red-700 whitespace-pre-wrap">{analysisError}</p>
                    <button
                      onClick={() => setAnalysisError(null)}
                      className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            )}
  
            {currentView === 'checker' && (
              <div>
                <TabNavigation
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                  hasResult={!!factCheckResult}
                  correctionCount={editorResult?.changesApplied?.length || 0}
                />
                <div className="mt-6">
                  {activeTab === 'analyze' && (
                    <AnalysisPanel
                      content={content}
                      setContent={setContent}
                      publishingContext={publishingContext}
                      setPublishingContext={setPublishingContext}
                      onAnalyze={handleAnalyze}
                      isAnalyzing={isAnalyzing}
                      apiStatus={apiStatus}
                    />
                  )}
                  {activeTab === 'report' && factCheckResult && (
                    <ReportPanel
                      result={factCheckResult}
                      onAutoCorrect={handleAutoCorrect}
                      onShowSchema={handleShowSchemaInput}
                      isProcessing={isAnalyzing}
                    />
                  )}
                  {activeTab === 'edit' && factCheckResult && (
                    <EditorialPanel
                      originalContent={content}
                      result={factCheckResult}
                      editorResult={editorResult}
                      onContentUpdate={setContent}
                    />
                  )}
                </div>
              </div>
            )}
            {currentView === 'history' && <HistoryView onSelectReport={handleSelectReport} />}
            {currentView === 'trending' && <TrendingMisinformation />}
          </main>
        </div>
  
        {showSchemaInputModal && (
          <SchemaInputForm
            factCheckResult={factCheckResult}
            onGenerate={handleGenerateSchema}
            onClose={() => setShowSchemaInputModal(false)}
          />
        )}
  
        {showSchemaModal && schemaData && (
          <SchemaPreviewModal
            schema={schemaData.schema}
            htmlSnippet={schemaData.htmlSnippet}
            validation={schemaData.validation}
            onClose={() => setShowSchemaModal(false)}
          />
        )}
  
        <SettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          onSave={handleSettingsSave}
          currentKeys={settings.apiKeys}
        />
      </div>
    );
}

function TabNavigation({ activeTab, onTabChange, hasResult, correctionCount }: any) {
    const tabs = [
      { id: 'analyze', label: 'Analyze Content', icon: Search, disabled: false },
      { id: 'report', label: 'Fact-Check Report', icon: FileText, disabled: !hasResult },
      { id: 'edit', label: 'Editorial Panel', icon: Edit3, disabled: !hasResult }
    ];
  
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2">
        <div className="flex space-x-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const isDisabled = tab.disabled;
            return (
              <button
                key={tab.id}
                onClick={() => !isDisabled && onTabChange(tab.id)}
                disabled={isDisabled}
                className={`
                  flex-1 px-6 py-3 rounded-lg font-medium transition-all flex items-center justify-center space-x-2
                  ${isActive
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                    : isDisabled
                    ? 'text-gray-400 cursor-not-allowed opacity-50'
                    : 'text-gray-700 hover:bg-gray-100'
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                <span>{tab.label}</span>
                {tab.id === 'edit' && correctionCount > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-yellow-500 text-white text-xs rounded-full">
                    {correctionCount}
                  </span>
                )}
                {tab.id === 'report' && hasResult && (
                  <span className="ml-2 px-2 py-0.5 bg-green-500 text-white text-xs rounded-full">
                    Ready
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
}
  
function AnalysisPanel({ content, setContent, publishingContext, setPublishingContext, onAnalyze, isAnalyzing, apiStatus }: any) {
    const contexts = [
      {
        id: 'journalism',
        label: 'Journalism & News',
        icon: Globe,
        description: 'AP Style, multiple source verification',
        guidelines: ['Two-source rule', 'Attribution required', 'Fact-check priority']
      },
      {
        id: 'editorial',
        label: 'Editorial & Opinion',
        icon: BookOpen,
        description: 'Opinion with fact-based support',
        guidelines: ['Clearly label opinion', 'Support with evidence', 'Disclosure required']
      },
      {
        id: 'content',
        label: 'Content Writing',
        icon: FileText,
        description: 'Blog posts, articles, marketing',
        guidelines: ['SEO best practices', 'Readability focus', 'Source linking']
      }
    ];
  
    return (
      <div className="space-y-6">
        {apiStatus === 'unavailable' && (
          <div className="p-4 bg-yellow-50 border-2 border-yellow-300 rounded-lg">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-6 h-6 text-yellow-600 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-yellow-900 mb-1">Server Configuration Required</h3>
                <p className="text-sm text-yellow-700">
                  Server-side APIs (SERP_API_KEY, NEWSAPI_API_KEY) are not configured. Please set these in your Vercel environment variables.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Publishing Context</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {contexts.map((ctx) => {
              const Icon = ctx.icon;
              return (
                <button
                  key={ctx.id}
                  onClick={() => setPublishingContext(ctx.id)}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    publishingContext === ctx.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <Icon className={`w-6 h-6 mt-0.5 ${publishingContext === ctx.id ? 'text-blue-600' : 'text-gray-400'}`} />
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 mb-1">{ctx.label}</h4>
                      <p className="text-xs text-gray-600 mb-2">{ctx.description}</p>
                      <ul className="space-y-1">
                        {ctx.guidelines.map((guide) => (
                          <li key={guide} className="text-xs text-gray-500 flex items-center space-x-1">
                            <CheckCircle className="w-3 h-3 text-green-500" />
                            <span>{guide}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
  
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Content to Verify</h3>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste your article, news content, or claim here for comprehensive fact-checking powered by Google Vertex AI..."
            className="w-full h-64 p-4 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all resize-none"
          />
          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-gray-600">
              {content.split(/\s+/).filter(Boolean).length} words • {content.length} characters
            </span>
            <button
              onClick={onAnalyze}
              disabled={isAnalyzing || !content.trim() || apiStatus === 'unavailable'}
              className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Analyzing with Vertex AI...</span>
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  <span>Analyze Content</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
}
  
function ReportPanel({ result, onAutoCorrect, onShowSchema, isProcessing }: any) {
    const getScoreColor = (score: number) => {
      if (score >= 75) return 'text-green-700 bg-green-100 border-green-300';
      if (score >= 50) return 'text-yellow-700 bg-yellow-100 border-yellow-300';
      return 'text-red-700 bg-red-100 border-red-300';
    };
  
    const displayScore = result.finalScore || result.final_score || result.overallAuthenticityScore || 0;
    const displayVerdict = result.finalVerdict || result.final_verdict || result.claimVerifications?.[0]?.status || 'UNVERIFIED';
  
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Fact-Check Report</h2>
              <p className="text-sm text-gray-600">Multi-tier verification powered by Vertex AI</p>
            </div>
            <div className={`px-6 py-3 rounded-xl border-2 font-bold text-2xl ${getScoreColor(displayScore)}`}>
              {displayScore}/100
            </div>
          </div>
  
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center space-x-2 mb-2">
                <Shield className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-semibold text-blue-900">Verdict</span>
              </div>
              <p className="text-lg font-bold text-blue-700">{displayVerdict}</p>
            </div>
  
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center space-x-2 mb-2">
                <Database className="w-5 h-5 text-green-600" />
                <span className="text-sm font-semibold text-green-900">Sources</span>
              </div>
              <p className="text-lg font-bold text-green-700">{result.evidence?.length || 0} verified</p>
            </div>
  
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <div className="flex items-center space-x-2 mb-2">
                <Award className="w-6 h-6 text-purple-600" />
                <span className="text-sm font-semibold text-purple-900">Method</span>
              </div>
              <p className="text-lg font-bold text-purple-700">{result.metadata?.methodUsed || result.metadata?.method_used || '3-Tier + AI'}</p>
            </div>
          </div>
  
          {result.reasoning && (
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="font-semibold text-gray-900 mb-2">AI Analysis Summary</h4>
              <p className="text-gray-700">{result.reasoning}</p>
            </div>
          )}
        </div>
  
        {(result.metadata?.tierBreakdown || result.metadata?.tier_breakdown) && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Verification Tiers</h3>
            <div className="space-y-3">
              {(result.metadata.tierBreakdown || result.metadata.tier_breakdown).map((tier: any, idx: number) => (
                <div key={idx} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-gray-900 capitalize">{tier.tier.replace('-', ' ')}</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      tier.success ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {tier.success ? '✓ Success' : '→ Escalated'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Confidence</p>
                      <p className="font-semibold text-gray-900">{tier.confidence.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Evidence</p>
                      <p className="font-semibold text-gray-900">{tier.evidenceCount || tier.evidence?.length || 0} sources</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Time</p>
                      <p className="font-semibold text-gray-900">{((tier.processingTimeMs || tier.processingTime || 0) / 1000).toFixed(2)}s</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
  
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Supporting Evidence ({result.evidence?.length || 0})</h3>
          <div className="space-y-4">
            {(result.evidence || []).slice(0, 10).map((evidence: any, idx: number) => (
              <div key={idx} className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-300 transition-all">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                      evidence.credibilityScore >= 75 ? 'bg-green-100' : 'bg-yellow-100'
                    }`}>
                      <Award className={`w-6 h-6 ${evidence.credibilityScore >= 75 ? 'text-green-600' : 'text-yellow-600'}`} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">{evidence.publisher}</h4>
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <span>Credibility: {evidence.credibilityScore}/100</span>
                        {evidence.publicationDate && (
                          <>
                            <span>•</span>
                            <span>{new Date(evidence.publicationDate).toLocaleDateString()}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  {evidence.url && (
                    <a
                      href={evidence.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1 text-sm text-blue-600 hover:text-blue-700 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors flex items-center space-x-1"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>View</span>
                    </a>
                  )}
                </div>
                <p className="text-gray-700 text-sm border-l-4 border-gray-300 pl-4">
                  "{(evidence.snippet || evidence.quote || '').substring(0, 200)}{(evidence.snippet || evidence.quote || '').length > 200 ? '...' : ''}"
                </p>
                <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                  <span className="flex items-center space-x-1">
                    <Info className="w-3 h-3" />
                    <span>Type: {evidence.type}</span>
                  </span>
                  {evidence.relevanceScore && (
                    <span>Relevance: {evidence.relevanceScore}/100</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
  
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Next Steps</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => onAutoCorrect('enhanced')}
              disabled={isProcessing}
              className="p-4 border-2 border-blue-500 text-blue-600 rounded-lg hover:bg-blue-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Edit3 className="w-6 h-6 mx-auto mb-2" />
              <p className="font-semibold">Auto-Correct</p>
              <p className="text-xs text-gray-600 mt-1">Apply AI corrections</p>
            </button>
  
            <button
              onClick={onShowSchema}
              className="p-4 border-2 border-green-500 text-green-600 rounded-lg hover:bg-green-50 transition-all"
            >
              <LinkIcon className="w-6 h-6 mx-auto mb-2" />
              <p className="font-semibold">Generate Schema</p>
              <p className="text-xs text-gray-600 mt-1">SEO markup</p>
            </button>
  
            <button
              onClick={() => {
                const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `fact-check-report-${Date.now()}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="p-4 border-2 border-purple-500 text-purple-600 rounded-lg hover:bg-purple-50 transition-all"
            >
              <Download className="w-6 h-6 mx-auto mb-2" />
              <p className="font-semibold">Export Report</p>
              <p className="text-xs text-gray-600 mt-1">Download JSON</p>
            </button>
          </div>
        </div>
      </div>
    );
}
  
function EditorialPanel({ originalContent, result, editorResult, onContentUpdate }: any) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Editorial Panel</h2>
  
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 mb-6">
            <h3 className="font-semibold text-gray-900 mb-2">Original Content</h3>
            <p className="text-gray-700 whitespace-pre-wrap">{originalContent}</p>
          </div>
  
          {editorResult && (
            <>
              <div className="p-4 bg-green-50 rounded-lg border border-green-200 mb-6">
                <h3 className="font-semibold text-green-900 mb-2">Corrected Content (Vertex AI)</h3>
                <p className="text-gray-700 whitespace-pre-wrap">{editorResult.editedText || editorResult.correctedText || 'No corrections available'}</p>
              </div>
  
              {editorResult.changesApplied && editorResult.changesApplied.length > 0 && (
                <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <h3 className="font-semibold text-yellow-900 mb-2">Changes Applied ({editorResult.changesApplied.length})</h3>
                  <ul className="space-y-2">
                    {editorResult.changesApplied.map((change: any, idx: number) => (
                      <li key={idx} className="text-sm text-gray-700">
                        <span className="font-semibold">{idx + 1}.</span> {change.reason || change.description || change}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
  
          {!editorResult && (
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-center">
              <p className="text-gray-600">Click "Auto-Correct" in the Report tab to generate AI-powered corrections</p>
            </div>
          )}
        </div>
      </div>
    );
}
  
function SchemaPreviewModal({ schema, htmlSnippet, validation, onClose }: any) {
    const [copied, setCopied] = useState(false);
  
    const handleCopy = () => {
      navigator.clipboard.writeText(htmlSnippet || JSON.stringify(schema, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };
  
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Schema Markup Preview</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
  
          <div className="p-6 space-y-4 overflow-y-auto flex-1">
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-gray-900">JSON-LD Schema</h4>
                <button
                  onClick={handleCopy}
                  className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2 text-sm transition-colors"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
              <pre className="text-xs text-gray-700 overflow-x-auto bg-white p-3 rounded border border-gray-300">
                {JSON.stringify(schema, null, 2)}
              </pre>
            </div>
  
            {validation && (
              <div className={`p-4 rounded-lg border ${
                validation.isValid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
              }`}>
                <h4 className="font-semibold mb-2">
                  {validation.isValid ? '✅ Valid Schema' : '❌ Schema Issues'}
                </h4>
                {validation.errors && validation.errors.length > 0 && (
                  <ul className="text-sm space-y-1">
                    {validation.errors.map((error: string, idx: number) => (
                      <li key={idx} className="text-red-700">• {error}</li>
                    ))}
                  </ul>
                )}
                {validation.isValid && (
                  <p className="text-sm text-green-700">
                    Schema is valid and ready for implementation. Add this to your page's &lt;head&gt; section.
                  </p>
                )}
              </div>
            )}
  
            {htmlSnippet && (
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h4 className="font-semibold text-gray-900 mb-2">HTML Implementation</h4>
                <pre className="text-xs text-gray-700 overflow-x-auto bg-white p-3 rounded border border-gray-300">
                  {htmlSnippet}
                </pre>
                <p className="text-xs text-gray-600 mt-2">
                  Copy this snippet and paste it into your HTML &lt;head&gt; section.
                </p>
              </div>
            )}
          </div>
  
          <div className="p-6 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Test your schema at <a href="https://search.google.com/test/rich-results" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google Rich Results Test</a>
              </p>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
}
