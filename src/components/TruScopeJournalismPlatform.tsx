import React, { useState, useEffect, useCallback } from 'react';
import { getApiKeys, hasApiKeys, saveApiKeys } from '../services/apiKeyService';
import { fetchAvailableModels } from '../services/geminiService';
import { ApiKeys, FactCheckReport } from '@/types';
import Sidebar from './Sidebar';
import SchemaInputForm from './SchemaInputForm';
import {
  FileText, CheckCircle, AlertTriangle, Link as LinkIcon,
  Download, Copy, Check, X, Search, Edit3, BookOpen,
  Globe, Calendar, Award, Shield, ExternalLink, Info,
  RefreshCw, Settings, TrendingUp, Database
} from 'lucide-react';
import HistoryView from './HistoryView';
import TrendingMisinformation from './TrendingMisinformation';
import SettingsModal from './SettingsModal';

const formatCitation = (source: any, style: string = 'ap', num?: number) => {
  const publisher = source.publisher || 'Unknown';
  const date = source.publishedDate || new Date().toISOString().split('T')[0];
  const url = source.url || '';

  if (style === 'ap') {
    return `According to ${publisher} (${date})${url ? `. Available at: ${url}` : ''}`;
  } else if (style === 'apa') {
    return `${publisher}. (${new Date(date).getFullYear()}). ${url}`;
  }
  return `${publisher}, ${date}`;
};

export default function TruScopeJournalismPlatform() {
  const [activeTab, setActiveTab] = useState<'analyze' | 'report' | 'edit'>('analyze');
  const [content, setContent] = useState('');
  const [publishingContext, setPublishingContext] = useState('journalism');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [factCheckResult, setFactCheckResult] = useState<FactCheckReport | null>(null);
  const [editorResult, setEditorResult] = useState<any>(null);
  const [showSchemaModal, setShowSchemaModal] = useState(false);
  const [showSchemaInputModal, setShowSchemaInputModal] = useState(false);
  const [apiStatus, setApiStatus] = useState<'checking' | 'available' | 'unavailable'>('checking');
  const [schemaData, setSchemaData] = useState<any>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [currentView, setCurrentView] = useState<'checker' | 'history' | 'trending'>('checker');

  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [settings, setSettings] = useState<{ apiKeys: ApiKeys }>({ apiKeys: {} });

  const handleNavigate = (view: 'checker' | 'history' | 'trending') => {
    setCurrentView(view);
  };

  useEffect(() => {
    console.log('🚀 Initializing TruScope Professional...');
    const keys = getApiKeys();
    setSettings({ apiKeys: keys });

    if (keys.gemini) {
      console.log('✅ API keys configured and ready');
    } else {
      console.warn('⚠️ No Gemini API key found');
    }

    checkAPIAvailability();
  }, []);

  const loadModels = useCallback(async () => {
    const geminiKey = settings.apiKeys.gemini;

    if (!geminiKey || geminiKey.trim() === '') {
      console.log('ℹ️ No Gemini API key - using fallback models');
      setAvailableModels(['gemini-2.0-flash-exp', 'gemini-1.5-flash-latest', 'gemini-1.5-pro-latest']);
      return;
    }

    setIsLoadingModels(true);
    console.log('🔄 Loading available Gemini models...');

    try {
      const models = await fetchAvailableModels(geminiKey);
      setAvailableModels(models);
      console.log(`✅ Loaded ${models.length} models`);
    } catch (e: any) {
      console.error('❌ Failed to load models:', e.message);
      // Fallback to default models
      setAvailableModels(['gemini-2.0-flash-exp', 'gemini-1.5-flash-latest', 'gemini-1.5-pro-latest']);
    } finally {
      setIsLoadingModels(false);
    }
  }, [settings.apiKeys.gemini]);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const handleSettingsSave = (newKeys: any) => {
    console.log('💾 Saving API keys...');
    saveApiKeys(newKeys);
    setSettings({ apiKeys: newKeys });
    setIsSettingsModalOpen(false);

    // Reload models with new key
    if (newKeys.gemini !== settings.apiKeys.gemini) {
      setTimeout(() => loadModels(), 500);
    }
  };

  const checkAPIAvailability = async () => {
    setApiStatus('checking');

    try {
      const response = await fetch('/api/health-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      setApiStatus(response.ok ? 'available' : 'unavailable');
    } catch {
      setApiStatus('unavailable');
    }
  };

  const handleAnalyze = async () => {
    if (!content.trim()) {
      alert('⚠️ Please enter content to analyze');
      return;
    }

    const apiKeys = getApiKeys();

    if (!apiKeys.gemini || apiKeys.gemini.trim() === '') {
      // Use mock API if Gemini key is not available
      const response = await fetch('/api/mock-fact-check');
      const result = await response.json();
      setFactCheckResult(result);
      setActiveTab('report');
      return;
    }

    setIsAnalyzing(true);
    setActiveTab('analyze');

    console.log('🚀 Starting fact-check analysis');
    console.log('📝 Content length:', content.length, 'characters');
    console.log('📋 Publishing context:', publishingContext);

    try {
      const modelToUse = apiKeys.geminiModel || 'gemini-2.0-flash-exp';
      console.log('🔑 Using Gemini model:', modelToUse);

      const response = await fetch('/api/fact-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: content,
          publishingContext,
          config: {
            gemini: apiKeys.gemini,
            geminiModel: modelToUse,
            factCheck: apiKeys.factCheck,
            search: apiKeys.search,
            searchId: apiKeys.searchId
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;

        try {
          errorData = JSON.parse(errorText);
        } catch {
          throw new Error(`Server error: ${response.status} - ${errorText.substring(0, 200)}`);
        }

        throw new Error(errorData.error || errorData.details || 'Fact-check request failed');
      }

      const result = await response.json();

      console.log('✅ Fact-check completed successfully');
      console.log('📊 Final Score:', result.overallAuthenticityScore);
      console.log('⚖️ Verdict:', result.claimVerifications?.[0]?.status);
      console.log('📋 Evidence Sources:', result.evidence?.length || 0);
      console.log('⏱️ Processing Time:', result.metadata?.processing_time_ms, 'ms');

      if (result.metadata?.tier_breakdown) {
        console.log('🎯 Verification Tiers:');
        result.metadata.tier_breakdown.forEach((tier: any) => {
          console.log(`  - ${tier.tier}: ${tier.success ? '✓' : '→'} (${tier.confidence.toFixed(1)}%)`);
        });
      }

      if (result.final_score < 50) {
        console.warn('❌ Low confidence result:', result.final_score);
      }

      setFactCheckResult(result);
      setActiveTab('report');

    } catch (error: any) {
      console.error('❌ Analysis failed:', error);
      alert(`Analysis failed: ${error.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAutoCorrect = async (mode: string) => {
    if (!factCheckResult) return;

    setIsAnalyzing(true);
    console.log('🔧 Starting auto-correction...');

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

      if (!response.ok) throw new Error('Auto-correction failed');

      const result = await response.json();
      setEditorResult(result);
      setActiveTab('edit');
      console.log('✅ Auto-correction completed');

    } catch (error: any) {
      console.error('❌ Auto-correction failed:', error);
      alert(`Auto-correction failed: ${error.message}`);
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
    setContent(claimText);
    setActiveTab('report');
    setCurrentView('checker');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex">
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
                  <p className="text-sm text-gray-600">Enterprise Fact-Checking & Editorial Suite</p>
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
                  {apiStatus === 'available' && '✅ API Ready'}
                  {apiStatus === 'unavailable' && '⚠️ API Offline'}
                </div>
                <span className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-sm font-semibold shadow-lg">
                  Pro Edition
                </span>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8">
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
        availableModels={availableModels}
        isLoadingModels={isLoadingModels}
      />
    </div>
  );
}

// ... (Rest of the component code - TabNavigation, AnalysisPanel, ReportPanel, etc. - remains the same as in your original file)

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

function AnalysisPanel({ content, setContent, publishingContext, setPublishingContext, onAnalyze, isAnalyzing }: any) {
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
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Publishing Context</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {contexts.map((ctx) => {
            const Icon = ctx.icon;
            return (
              <button
                key={ctx.id}
                onClick={() => setPublishingContext(ctx.id)}
                className={`
                  p-4 rounded-lg border-2 transition-all text-left
                  ${publishingContext === ctx.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                  }
                `}
              >
                <div className="flex items-start space-x-3">
                  <Icon className={`w-6 h-6 mt-0.5 ${publishingContext === ctx.id ? 'text-blue-600' : 'text-gray-400'}`} />
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">{ctx.label}</h4>
                    <p className="text-sm text-gray-600 mt-1">{ctx.description}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {ctx.guidelines.map((guide) => (
                        <span key={guide} className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                          {guide}
                        </span>
                      ))}
                    </div>
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
          placeholder="Paste your article, news content, or claim here for comprehensive fact-checking..."
          className="w-full h-64 p-4 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all resize-none"
        />
        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-gray-600">
            {content.split(/\s+/).filter(Boolean).length} words
          </span>
          <button
            onClick={onAnalyze}
            disabled={isAnalyzing || !content.trim()}
            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Analyzing...</span>
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

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Fact-Check Report</h2>
            <p className="text-gray-600 mt-1">Tiered verification analysis</p>
          </div>
          <div className={`px-6 py-3 rounded-xl border-2 font-bold text-2xl ${getScoreColor(result.overallAuthenticityScore)}`}>
            {result.overallAuthenticityScore}/100
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center space-x-2 mb-2">
              <Shield className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-semibold text-blue-900">Verdict</span>
            </div>
            <p className="text-lg font-bold text-blue-700">{result.claimVerifications?.[0]?.status || 'N/A'}</p>
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
            <p className="text-lg font-bold text-purple-700">{result.metadata?.method_used || 'Tiered'}</p>
          </div>
        </div>

        {result.reasoning && (
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h4 className="font-semibold text-gray-900 mb-2">Analysis Summary</h4>
            <p className="text-gray-700">{result.reasoning}</p>
          </div>
        )}
      </div>

      {result.metadata?.tier_breakdown && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Verification Tiers</h3>
          <div className="space-y-3">
            {result.metadata.tier_breakdown.map((tier: any, idx: number) => (
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
                    <p className="font-semibold text-gray-900">{tier.evidence?.length || 0} sources</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Time</p>
                    <p className="font-semibold text-gray-900">{(tier.processingTime / 1000).toFixed(2)}s</p>
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
                    evidence.score >= 75 ? 'bg-green-100' : 'bg-yellow-100'
                  }`}>
                    <Award className={`w-6 h-6 ${evidence.score >= 75 ? 'text-green-600' : 'text-yellow-600'}`} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">{evidence.publisher}</h4>
                    <p className="text-sm text-gray-600">Credibility: {evidence.score}/100</p>
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
              <p className="text-gray-700 text-sm border-l-4 border-gray-300 pl-4">"{evidence.quote.substring(0, 200)}"</p>
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
            className="p-4 border-2 border-blue-500 text-blue-600 rounded-lg hover:bg-blue-50 transition-all disabled:opacity-50"
          >
            <Edit3 className="w-6 h-6 mx-auto mb-2" />
            <p className="font-semibold">Auto-Correct</p>
            <p className="text-xs text-gray-600 mt-1">Apply corrections</p>
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
              a.download = 'fact-check-report.json';
              a.click();
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
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Editorial Panel</h2>
      <div className="space-y-4">
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="font-semibold text-blue-900 mb-2">Original Content</h3>
          <p className="text-gray-700 whitespace-pre-wrap">{originalContent}</p>
        </div>

        {editorResult && (
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <h3 className="font-semibold text-green-900 mb-2">Suggested Corrections</h3>
            <p className="text-gray-700 whitespace-pre-wrap">{editorResult.correctedText || 'No corrections available'}</p>
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-900">Schema Markup Preview</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-gray-900">JSON-LD Schema</h4>
              <button
                onClick={handleCopy}
                className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2 text-sm"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
            <pre className="text-xs text-gray-700 overflow-x-auto">
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}