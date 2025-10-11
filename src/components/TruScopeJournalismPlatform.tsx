import React, { useState, useEffect, useCallback, FC } from 'react';
import { getApiKeys, saveApiKeys } from '../services/apiKeyService';
import { fetchAvailableModels } from '../services/geminiService';
import { ApiKeys, FactCheckReport } from '@/types'; // Assuming these types exist in '@/types'
import Sidebar from './Sidebar';
import SchemaInputForm from './SchemaInputForm';
import HistoryView from './HistoryView';
import TrendingMisinformation from './TrendingMisinformation';
import SettingsModal from './SettingsModal';
import { 
    FileText, CheckCircle, AlertTriangle, Link as LinkIcon, Download, Copy, Check, 
    X, Search, Edit3, BookOpen, Globe, Calendar, Award, Shield, ExternalLink, 
    Info, RefreshCw, Settings, TrendingUp, Database 
} from 'lucide-react';

// Define Prop Types for Sub-components right here for clarity
type TabNavigationProps = {
  activeTab: 'analyze' | 'report' | 'edit';
  onTabChange: (tab: 'analyze' | 'report' | 'edit') => void;
  hasResult: boolean;
  correctionCount: number;
};

type AnalysisPanelProps = {
  content: string;
  setContent: (value: string) => void;
  publishingContext: string;
  setPublishingContext: (value: string) => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
};

type ReportPanelProps = {
  result: FactCheckReport;
  onAutoCorrect: (mode: string) => void;
  onShowSchema: () => void;
  isProcessing: boolean;
};

type EditorialPanelProps = {
  originalContent: string;
  editorResult: { correctedText: string; changesApplied: any[] } | null;
};

type SchemaPreviewModalProps = {
    schema: object;
    htmlSnippet: string;
    validation: { isValid: boolean; errors?: string[] };
    onClose: () => void;
};


// Main Component
export default function TruScopeJournalismPlatform() {
  // --- STATE MANAGEMENT ---
  const [currentView, setCurrentView] = useState<'checker' | 'history' | 'trending'>('checker');
  const [activeTab, setActiveTab] = useState<'analyze' | 'report' | 'edit'>('analyze');
  const [content, setContent] = useState('');
  const [publishingContext, setPublishingContext] = useState('journalism');
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [factCheckResult, setFactCheckResult] = useState<FactCheckReport | null>(null);
  const [editorResult, setEditorResult] = useState<{ correctedText: string; changesApplied: any[] } | null>(null);
  const [schemaData, setSchemaData] = useState<{ schema: object; htmlSnippet: string; validation: any } | null>(null);

  const [settings, setSettings] = useState<{ apiKeys: ApiKeys }>({ apiKeys: getApiKeys() });
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  
  const [apiStatus, setApiStatus] = useState<'checking' | 'available' | 'unavailable'>('checking');

  // Modal States
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [showSchemaInputModal, setShowSchemaInputModal] = useState(false);
  const [showSchemaModal, setShowSchemaModal] = useState(false);

  // --- API & DATA FETCHING LOGIC ---

  const loadModels = useCallback(async (geminiKey: string | undefined) => {
    const fallbackModels = ['gemini-2.0-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-pro-latest'];
    if (!geminiKey || geminiKey.trim() === '') {
      setAvailableModels(fallbackModels);
      return;
    }
    setIsLoadingModels(true);
    try {
      const models = await fetchAvailableModels(geminiKey);
      setAvailableModels(models.length > 0 ? models : fallbackModels);
    } catch (e: any) {
      console.error('❌ Failed to load models:', e.message);
      setAvailableModels(fallbackModels);
    } finally {
      setIsLoadingModels(false);
    }
  }, []);

  const checkAPIAvailability = useCallback(async () => {
    setApiStatus('checking');
    try {
      const response = await fetch('/api/health-check', { method: 'POST' });
      setApiStatus(response.ok ? 'available' : 'unavailable');
    } catch {
      setApiStatus('unavailable');
    }
  }, []);

  useEffect(() => {
    console.log('🚀 Initializing TruScope Professional...');
    checkAPIAvailability();
    loadModels(settings.apiKeys.gemini);
  }, [checkAPIAvailability, loadModels, settings.apiKeys.gemini]);

  // --- EVENT HANDLERS ---

  const handleSettingsSave = (newKeys: ApiKeys) => {
    console.log('💾 Saving API keys...');
    saveApiKeys(newKeys);
    setSettings({ apiKeys: newKeys });
    setIsSettingsModalOpen(false);
  };

  const handleAnalyze = async () => {
    if (!content.trim()) return; // TODO: Replace with a toast notification
    const { apiKeys } = settings;
    if (!apiKeys.gemini) {
      setIsSettingsModalOpen(true);
      return;
    }

    setIsAnalyzing(true);
    setFactCheckResult(null); // Clear previous results
    setActiveTab('analyze');

    try {
      const response = await fetch('/api/fact-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: content,
          publishingContext,
          config: {
            gemini: apiKeys.gemini,
            geminiModel: apiKeys.geminiModel || 'gemini-2.0-flash',
            factCheck: apiKeys.factCheck,
            search: apiKeys.search,
            searchId: apiKeys.searchId,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'An unknown server error occurred.' }));
        throw new Error(errorData.error || `Request failed with status ${response.status}`);
      }
      
      const result = await response.json();
      setFactCheckResult(result);
      setActiveTab('report');

    } catch (error: any) {
      console.error('❌ Analysis failed:', error);
      // TODO: Show error to user via toast notification: `Analysis failed: ${error.message}`
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAutoCorrect = async (mode: string) => {
    if (!factCheckResult) return;
    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/auto-correct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: content, factCheckResult, mode }),
      });
      if (!response.ok) throw new Error('Auto-correction failed');
      const result = await response.json();
      setEditorResult(result);
      setActiveTab('edit');
    } catch (error: any) {
      console.error('❌ Auto-correction failed:', error);
      // TODO: Show error to user via toast notification
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerateSchema = async (formData: any) => {
    try {
      const response = await fetch('/api/generate-schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, factCheckResult }),
      });
      if (!response.ok) throw new Error('Schema generation failed');
      const data = await response.json();
      setSchemaData(data);
      setShowSchemaInputModal(false);
      setShowSchemaModal(true);
    } catch (error: any) {
      console.error('❌ Schema generation failed:', error);
      // TODO: Show error to user via toast notification
    }
  };

  const handleSelectReport = (report: FactCheckReport, claimText: string) => {
    setFactCheckResult(report);
    setContent(claimText);
    setActiveTab('report');
    setCurrentView('checker');
  };

  // --- RENDER LOGIC ---
  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        currentView={currentView} 
        onNavigate={(view) => setCurrentView(view)} 
        onSettingsClick={() => setIsSettingsModalOpen(true)} 
      />
      
      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm p-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <button type="button" className="md:hidden text-gray-500" onClick={() => setIsSidebarOpen(true)}>
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
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
                        apiStatus === 'available' ? 'bg-green-100 text-green-700' :
                        apiStatus === 'unavailable' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                        {apiStatus === 'checking' && '🔄 Checking...'}
                        {apiStatus === 'available' && '✅ API Ready'}
                        {apiStatus === 'unavailable' && '⚠️ API Offline'}
                    </div>
                    <span className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-sm font-semibold shadow-lg">Pro Edition</span>
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
                    onShowSchema={() => setShowSchemaInputModal(true)}
                    isProcessing={isAnalyzing}
                  />
                )}
                {activeTab === 'edit' && factCheckResult && (
                  <EditorialPanel
                    originalContent={content}
                    editorResult={editorResult}
                  />
                )}
              </div>
            </div>
          )}
          {currentView === 'history' && <HistoryView onSelectReport={handleSelectReport} />}
          {currentView === 'trending' && <TrendingMisinformation />}
        </main>
      </div>

      {showSchemaInputModal && factCheckResult && (
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


// --- SUB-COMPONENTS ---

const TabNavigation: FC<TabNavigationProps> = ({ activeTab, onTabChange, hasResult, correctionCount }) => {
  const tabs = [
    { id: 'analyze', label: 'Analyze Content', icon: Search, disabled: false },
    { id: 'report', label: 'Fact-Check Report', icon: FileText, disabled: !hasResult },
    { id: 'edit', label: 'Editorial Panel', icon: Edit3, disabled: !hasResult },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2">
      <div className="flex space-x-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => !tab.disabled && onTabChange(tab.id as any)}
              disabled={tab.disabled}
              className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all flex items-center justify-center space-x-2 ${
                isActive ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                : tab.disabled ? 'text-gray-400 cursor-not-allowed opacity-50' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{tab.label}</span>
              {tab.id === 'edit' && correctionCount > 0 && <span className="ml-2 px-2 py-0.5 bg-yellow-500 text-white text-xs rounded-full">{correctionCount}</span>}
              {tab.id === 'report' && hasResult && <span className="ml-2 px-2 py-0.5 bg-green-500 text-white text-xs rounded-full">Ready</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const AnalysisPanel: FC<AnalysisPanelProps> = ({ content, setContent, publishingContext, setPublishingContext, onAnalyze, isAnalyzing }) => {
  const contexts = [
    { id: 'journalism', label: 'Journalism & News', icon: Globe, description: 'AP Style, multiple source verification' },
    { id: 'editorial', label: 'Editorial & Opinion', icon: BookOpen, description: 'Opinion with fact-based support' },
    { id: 'content', label: 'Content Writing', icon: FileText, description: 'Blog posts, articles, marketing' },
  ];
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Publishing Context</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {contexts.map((ctx) => (
                  <button key={ctx.id} onClick={() => setPublishingContext(ctx.id)} className={`p-4 rounded-lg border-2 transition-all text-left ${publishingContext === ctx.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <ctx.icon className={`w-6 h-6 mb-2 ${publishingContext === ctx.id ? 'text-blue-600' : 'text-gray-400'}`} />
                      <p className="font-semibold text-gray-800">{ctx.label}</p>
                      <p className="text-sm text-gray-600">{ctx.description}</p>
                  </button>
              ))}
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
          <span className="text-sm text-gray-600">{content.split(/\s+/).filter(Boolean).length} words</span>
          <button
            onClick={onAnalyze}
            disabled={isAnalyzing || !content.trim()}
            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {isAnalyzing ? (
              <><RefreshCw className="w-5 h-5 animate-spin" /><span>Analyzing...</span></>
            ) : (
              <><Search className="w-5 h-5" /><span>Analyze Content</span></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

const ReportPanel: FC<ReportPanelProps> = ({ result, onAutoCorrect, onShowSchema, isProcessing }) => {
    const getScoreColor = (score: number) => {
        if (score >= 75) return 'text-green-700 bg-green-100 border-green-300';
        if (score >= 50) return 'text-yellow-700 bg-yellow-100 border-yellow-300';
        return 'text-red-700 bg-red-100 border-red-300';
    };
    const displayScore = result.final_score ?? 0;
    const displayVerdict = result.final_verdict ?? 'UNVERIFIED';

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900">Fact-Check Report</h3>
                        <p className="text-gray-600">Overall authenticity and verification analysis.</p>
                    </div>
                    <div className={`px-6 py-3 rounded-xl border-2 font-bold text-2xl ${getScoreColor(displayScore)}`}>
                        {displayScore}/100
                    </div>
                </div>
                {result.reasoning && <p className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-gray-700">{result.reasoning}</p>}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Evidence & Sources ({result.evidence?.length || 0})</h3>
                <div className="space-y-4">
                    {(result.evidence || []).slice(0, 10).map((evidence, idx) => (
                        <div key={idx} className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-all">
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center space-x-3">
                                    <Award className={`w-6 h-6 ${evidence.score >= 75 ? 'text-green-600' : 'text-yellow-600'}`} />
                                    <div>
                                        <h4 className="font-semibold text-gray-900">{evidence.publisher}</h4>
                                        <p className="text-sm text-gray-600">Credibility: {evidence.score}/100</p>
                                    </div>
                                </div>
                                {evidence.url && <a href={evidence.url} target="_blank" rel="noopener noreferrer" className="px-3 py-1 text-sm text-blue-600 hover:text-blue-700 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors flex items-center space-x-1"><ExternalLink className="w-4 h-4" /><span>View</span></a>}
                            </div>
                            <p className="text-gray-700 text-sm border-l-4 border-gray-300 pl-4">"{evidence.quote.substring(0, 200)}..."</p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Next Steps</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button onClick={() => onAutoCorrect('enhanced')} disabled={isProcessing} className="p-4 border-2 border-blue-500 text-blue-600 rounded-lg hover:bg-blue-50 transition-all disabled:opacity-50 flex flex-col items-center justify-center"><Edit3 className="w-6 h-6 mb-2" /><p className="font-semibold">Auto-Correct</p></button>
                    <button onClick={onShowSchema} className="p-4 border-2 border-green-500 text-green-600 rounded-lg hover:bg-green-50 transition-all flex flex-col items-center justify-center"><LinkIcon className="w-6 h-6 mb-2" /><p className="font-semibold">Generate Schema</p></button>
                    <button onClick={() => { /* Export logic */ }} className="p-4 border-2 border-purple-500 text-purple-600 rounded-lg hover:bg-purple-50 transition-all flex flex-col items-center justify-center"><Download className="w-6 h-6 mb-2" /><p className="font-semibold">Export Report</p></button>
                </div>
            </div>
        </div>
    );
};

const EditorialPanel: FC<EditorialPanelProps> = ({ originalContent, editorResult }) => {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Editorial Panel</h3>
            <div className="space-y-6">
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <h4 className="font-semibold text-gray-800 mb-2">Original Content</h4>
                    <p className="text-gray-600 whitespace-pre-wrap">{originalContent}</p>
                </div>
                {editorResult ? (
                    <>
                        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                            <h4 className="font-semibold text-green-900 mb-2">Corrected Content</h4>
                            <p className="text-gray-700 whitespace-pre-wrap">{editorResult.correctedText}</p>
                        </div>
                        {editorResult.changesApplied?.length > 0 && (
                            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                                <h4 className="font-semibold text-yellow-900 mb-2">Changes Applied ({editorResult.changesApplied.length})</h4>
                                <ul className="space-y-2 list-disc list-inside">
                                    {editorResult.changesApplied.map((change, idx) => <li key={idx} className="text-sm text-gray-700">{change.description || change}</li>)}
                                </ul>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-center"><p className="text-gray-600">Click "Auto-Correct" in the Report tab to generate corrections.</p></div>
                )}
            </div>
        </div>
    );
};

const SchemaPreviewModal: FC<SchemaPreviewModalProps> = ({ schema, htmlSnippet, validation, onClose }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(htmlSnippet || JSON.stringify(schema, null, 2));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-900">Schema Markup Preview</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X /></button>
                </div>
                <div className="p-6 space-y-4 overflow-y-auto">
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold text-gray-900">JSON-LD Schema</h4>
                            <button onClick={handleCopy} className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2 text-sm transition-colors">
                                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                <span>{copied ? 'Copied!' : 'Copy'}</span>
                            </button>
                        </div>
                        <pre className="text-xs text-gray-700 overflow-x-auto bg-white p-3 rounded border border-gray-300">
                            {JSON.stringify(schema, null, 2)}
                        </pre>
                    </div>
                    {/* Validation & HTML Snippet sections would go here as in the original code */}
                </div>
                <div className="p-6 border-t border-gray-200 bg-gray-50 text-right">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">Close</button>
                </div>
            </div>
        </div>
    );
};
