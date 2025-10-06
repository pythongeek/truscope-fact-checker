import React, { useState, useEffect } from 'react';
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

// Import citation formatter
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
  const [factCheckResult, setFactCheckResult] = useState<any>(null);
  const [editorResult, setEditorResult] = useState<any>(null);
  const [showSchemaModal, setShowSchemaModal] = useState(false);
  const [showSchemaInputModal, setShowSchemaInputModal] = useState(false);
  const [apiStatus, setApiStatus] = useState<'checking' | 'available' | 'unavailable'>('checking');
  const [schemaData, setSchemaData] = useState<any>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentView, setCurrentView] = useState<'checker' | 'history' | 'trending'>('checker');

  const handleNavigate = (view: 'checker' | 'history' | 'trending') => {
    setCurrentView(view);
  };

  useEffect(() => {
    checkAPIAvailability();
  }, []);

  // API helper function
  const callApi = async (action: string, body: any) => {
    const response = await fetch('/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...body }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.details || `API action '${action}' failed`);
    }
    return response.json();
  };

  const checkAPIAvailability = async () => {
    try {
      await callApi('health-check', {});
      setApiStatus('available');
    } catch {
      setApiStatus('unavailable');
    }
  };

  const handleAnalyze = async () => {
    if (!content.trim()) {
      alert('Please enter content to analyze');
      return;
    }

    setIsAnalyzing(true);
    setActiveTab('analyze');

    try {
      const result = await callApi('fact-check', { text: content, publishingContext });
      setFactCheckResult(result);
      setActiveTab('report');
    } catch (error: any) {
      console.error('Analysis failed:', error);
      alert(`Analysis failed: ${error.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAutoCorrect = async (mode: string) => {
    if (!factCheckResult) return;

    setIsAnalyzing(true);

    try {
      const result = await callApi('auto-correct', {
        text: content,
        factCheckResult: factCheckResult,
        mode: mode,
      });
      setEditorResult(result);
      setActiveTab('edit');
    } catch (error: any) {
      console.error('Auto-correction failed:', error);
      alert(`Auto-correction failed: ${error.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleShowSchemaInput = () => {
    setShowSchemaInputModal(true);
  };

  const handleGenerateSchema = async (formData: any) => {
    if (!factCheckResult) return;

    try {
      const data = await callApi('generate-schema', formData);
      setSchemaData(data);
      setShowSchemaInputModal(false);
      setShowSchemaModal(true);
    } catch (error: any) {
      console.error('Schema generation failed:', error);
      alert(`Schema generation failed: ${error.message}`);
    }
  };

  const handleSelectReport = (report: any, claimText: string) => {
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
        onSettingsClick={() => {
          // Placeholder for settings functionality
          console.log('Settings clicked');
        }}
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
          <div className={`px-6 py-3 rounded-xl border-2 font-bold text-2xl ${getScoreColor(result.final_score)}`}>
            {result.final_score}/100
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center space-x-2 mb-2">
              <Shield className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-semibold text-blue-900">Verdict</span>
            </div>
            <p className="text-lg font-bold text-blue-700">{result.final_verdict}</p>
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
              <Award className="w-5 h-5 text-purple-600" />
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
                    <p className="font-semibold text-gray-900">{tier.evidence_count} sources</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Time</p>
                    <p className="font-semibold text-gray-900">{(tier.processing_time_ms / 1000).toFixed(2)}s</p>
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
  const [editedContent, setEditedContent] = useState(editorResult?.editedText || originalContent);
  const [showDiff, setShowDiff] = useState(true);
  const [citationStyle, setCitationStyle] = useState('ap');

  const corrections = (editorResult?.changesApplied || []);

  const applyCorrection = (correction: any) => {
    setEditedContent((prev: string) => prev + '\n\n' + correction.newPhrase);
  };

  const exportContent = () => {
    const citations = (result.evidence || []).slice(0, 10).map((ev: any, idx: number) =>
      formatCitation(ev, citationStyle, idx + 1)
    ).join('\n\n');

    const fullContent = `${editedContent}\n\n---\n\nREFERENCES\n\n${citations}\n\n---\n\nFACT-CHECK VERIFICATION\nScore: ${result.final_score}/100\nVerdict: ${result.final_verdict}\nDate: ${new Date().toLocaleDateString()}`;

    const blob = new Blob([fullContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'verified-article.txt';
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Editorial Panel</h2>
        <p className="text-gray-600">Review and apply suggested corrections</p>
      </div>

      {corrections.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5">
          <h3 className="font-semibold text-yellow-900 mb-4">{corrections.length} Suggested Corrections</h3>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {corrections.map((correction: any, idx: number) => (
              <div key={idx} className="bg-white border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-xs font-bold text-yellow-700 uppercase px-2 py-1 bg-yellow-100 rounded">
                    {correction.type}
                  </span>
                  <button
                    onClick={() => applyCorrection(correction)}
                    className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 text-xs font-medium"
                  >
                    Apply
                  </button>
                </div>
                <p className="text-sm text-gray-700">{correction.reason}</p>
                <div className="mt-2 text-xs">
                  <p className="text-green-600">{correction.newPhrase.substring(0, 100)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={showDiff}
                onChange={(e) => setShowDiff(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-gray-700">Show comparison</span>
            </label>

            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Citation:</span>
              <select
                value={citationStyle}
                onChange={(e) => setCitationStyle(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded text-sm"
              >
                <option value="ap">AP Style</option>
                <option value="apa">APA</option>
                <option value="mla">MLA</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {showDiff ? (
        <div className="grid grid-cols-2 gap-4">
          <div className="border-2 border-gray-300 rounded-lg overflow-hidden">
            <div className="bg-gray-100 px-4 py-2">
              <h4 className="font-semibold text-gray-700 text-sm">Original</h4>
            </div>
            <div className="p-4 bg-gray-50 h-96 overflow-y-auto">
              <pre className="whitespace-pre-wrap text-sm text-gray-700">{originalContent}</pre>
            </div>
          </div>

          <div className="border-2 border-blue-500 rounded-lg overflow-hidden">
            <div className="bg-blue-50 px-4 py-2">
              <h4 className="font-semibold text-blue-700 text-sm">Edited</h4>
            </div>
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="w-full h-96 p-4 border-0 resize-none text-sm"
            />
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            className="w-full h-96 p-4 border-2 border-gray-300 rounded-lg resize-none text-sm"
          />
        </div>
      )}

      <div className="flex items-center justify-between bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <button
          onClick={() => setEditedContent(originalContent)}
          className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
        >
          Reset
        </button>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              onContentUpdate(editedContent);
              alert('Content updated!');
            }}
            className="px-6 py-2 border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 font-medium"
          >
            Save
          </button>
          <button
            onClick={exportContent}
            className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:shadow-lg font-medium flex items-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function SchemaPreviewModal({ schema, htmlSnippet, validation, onClose }: any) {
  const [copied, setCopied] = useState(false);

  const copySchema = () => {
    navigator.clipboard.writeText(htmlSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden">
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4 flex items-center justify-between">
          <h3 className="text-xl font-bold text-white">Schema.org Markup (ClaimReview)</h3>
          <button onClick={onClose} className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
          {validation && !validation.isValid && (
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h4 className="font-semibold text-yellow-900 mb-2">Validation Warnings</h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                {validation.missingFields?.map((field: string) => (
                  <li key={field}>• Missing: {field}</li>
                ))}
                {validation.warnings?.map((warning: string) => (
                  <li key={warning}>• {warning}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-gray-600">Copy this markup to your page's &lt;head&gt;</p>
            <button
              onClick={copySchema}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>

          <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
            <pre className="text-green-400 text-sm font-mono">
              <code>{htmlSnippet}</code>
            </pre>
          </div>

          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2 flex items-center">
              <Info className="w-4 h-4 mr-2" />
              Usage Instructions
            </h4>
            <ol className="text-sm text-blue-700 space-y-2">
              <li>1. Copy the markup above</li>
              <li>2. Paste it in your HTML &lt;head&gt; section</li>
              <li>3. Validate at <a href="https://search.google.com/test/rich-results" target="_blank" rel="noopener noreferrer" className="underline">Google's Rich Results Test</a></li>
              <li>4. Helps with SEO and fact-check visibility</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
