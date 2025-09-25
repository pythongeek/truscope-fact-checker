import React, { useState, useEffect } from 'react';
import { FactCheckReport } from '@/types/factCheck';
import { AdvancedCorrectorService } from '@/services/advancedCorrector';

// Enhanced types for industry-standard features
interface EditorMode {
  id: string;
  name: string;
  description: string;
  icon: string;
  costTier: 'low' | 'medium' | 'high';
  processingTime: string;
  category: 'correction' | 'enhancement' | 'optimization' | 'academic';
}

interface EditorResult {
  mode: string;
  originalText: string;
  editedText: string;
  improvementScore: number;
  processingTime: number;
  confidence: number;
  changesApplied: ContentChange[];
  tokensUsed: number;
  costEstimate: number;
  version: string;
}

interface ContentChange {
  type: 'addition' | 'deletion' | 'modification' | 'restructure';
  originalPhrase: string;
  newPhrase?: string;
  reason: string;
  confidence: number;
  position: { start: number; end: number };
}

interface ProcessingJob {
  id: string;
  mode: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  startTime: number;
  estimatedCompletion?: number;
  error?: string;
}

interface AutoEditorProps {
  originalText: string;
  factCheckReport: FactCheckReport;
  isOpen: boolean;
  onClose: () => void;
}

const AutoEditor: React.FC<AutoEditorProps> = ({
  originalText,
  factCheckReport,
  isOpen,
  onClose
}) => {
  // State management
  const [selectedMode, setSelectedMode] = useState<string>('quick-fix');
  const [editorResults, setEditorResults] = useState<{ [key: string]: EditorResult }>({});
  const [activeTab, setActiveTab] = useState<'selector' | 'results' | 'comparison' | 'history'>('selector');
  const [customPrompt, setCustomPrompt] = useState('');
  const [processingJobs, setProcessingJobs] = useState<{ [key: string]: ProcessingJob }>({});
  const [savedVersions, setSavedVersions] = useState<{ [key: string]: EditorResult[] }>({});
  const [exportFormat, setExportFormat] = useState<'json' | 'markdown' | 'docx' | 'txt'>('json');
  const [batchProcessingStatus, setBatchProcessingStatus] = useState<'idle' | 'processing' | 'completed'>('idle');
  const [previewMode, setPreviewMode] = useState<'split' | 'overlay' | 'tabs'>('split');

  // Editor modes configuration
  const editorModes: EditorMode[] = [
    {
      id: 'quick-fix',
      name: 'Quick Fix',
      description: 'Fast factual corrections and basic improvements',
      icon: '🔧',
      costTier: 'low',
      processingTime: '~10s',
      category: 'correction'
    },
    {
      id: 'enhanced',
      name: 'Enhanced',
      description: 'Comprehensive improvements with style refinements',
      icon: '✨',
      costTier: 'medium',
      processingTime: '~30s',
      category: 'enhancement'
    },
    {
      id: 'complete-rewrite',
      name: 'Complete Rewrite',
      description: 'Full content reconstruction while preserving facts',
      icon: '📝',
      costTier: 'high',
      processingTime: '~60s',
      category: 'enhancement'
    },
    {
      id: 'seo-optimized',
      name: 'SEO Optimized',
      description: 'Search engine optimized with keyword integration',
      icon: '📊',
      costTier: 'medium',
      processingTime: '~25s',
      category: 'optimization'
    },
    {
      id: 'academic',
      name: 'Academic',
      description: 'Scholarly tone with proper citations and references',
      icon: '🎓',
      costTier: 'high',
      processingTime: '~45s',
      category: 'academic'
    },
    {
      id: 'expansion',
      name: 'Expansion',
      description: 'Detailed content expansion with additional context',
      icon: '📈',
      costTier: 'high',
      processingTime: '~50s',
      category: 'enhancement'
    }
  ];

  const handleEditorProcessing = async (
    mode: string,
    customInstructions?: string
  ): Promise<EditorResult> => {
    const job: ProcessingJob = {
      id: `job_${Date.now()}_${mode}`,
      mode,
      status: 'queued',
      progress: 0,
      startTime: Date.now(),
    };

    setProcessingJobs((prev) => ({ ...prev, [mode]: job }));

    try {
      const correctorService = AdvancedCorrectorService.getInstance();
      console.log(`🚀 Starting ${mode} editor processing...`);
      setProcessingJobs((prev) => ({
        ...prev,
        [mode]: { ...prev[mode], status: 'processing', progress: 10 },
      }));

      const serviceResult = await correctorService.processContent(
        mode as any, // The service expects a more specific type
        originalText,
        factCheckReport,
        customInstructions
      );

      setProcessingJobs((prev) => ({
        ...prev,
        [mode]: { ...prev[mode], progress: 80 },
      }));

      // Adapt serviceResult to the component's EditorResult type
      const result: EditorResult = {
        ...serviceResult,
        tokensUsed: 0, // Placeholder
        costEstimate: 0, // Placeholder
        version: `v1.${Date.now()}`,
      };

      console.log('✅ Editor processing completed.');
      setProcessingJobs((prev) => ({
        ...prev,
        [mode]: { ...prev[mode], status: 'completed', progress: 100 },
      }));

      return result;
    } catch (error) {
      console.error('Editor processing failed:', error);
      setProcessingJobs((prev) => ({
        ...prev,
        [mode]: { ...prev[mode], status: 'failed', error: (error as Error).message },
      }));
      throw error;
    }
  };

  // Independent function handlers - FIXED INDEPENDENCE ISSUE
  const handleIndividualModeProcess = async (modeId: string) => {
    try {
      const result = await handleEditorProcessing(modeId, customPrompt);
      setEditorResults((prev) => ({ ...prev, [modeId]: result }));
      setActiveTab('results');

      // Save to version history
      setSavedVersions((prev) => ({
        ...prev,
        [modeId]: [...(prev[modeId] || []), result],
      }));
    } catch (error) {
      console.error(`Failed to process ${modeId}:`, error);
      // Error state is already set in handleEditorProcessing
    }
  };

  // Independent batch processing - COMPLETELY SEPARATE
  const handleBatchProcess = async () => {
    setBatchProcessingStatus('processing');
    const batchModes = ['quick-fix', 'enhanced', 'seo-optimized'];

    try {
      const promises = batchModes.map((mode) => handleEditorProcessing(mode, customPrompt));
      const results = await Promise.all(promises);

      const newEditorResults: { [key: string]: EditorResult } = {};
      const newSavedVersions: { [key:string]: EditorResult[] } = {};

      results.forEach((result, index) => {
        const mode = batchModes[index];
        newEditorResults[mode] = result;
        newSavedVersions[mode] = [...(savedVersions[mode] || []), result];
      });

      setEditorResults((prev) => ({ ...prev, ...newEditorResults }));
      setSavedVersions((prev) => ({ ...prev, ...newSavedVersions }));

      setBatchProcessingStatus('completed');
      setActiveTab('results');
    } catch (error) {
      console.error('Batch processing failed:', error);
      setBatchProcessingStatus('idle');
    }
  };

  // Enhanced export functionality
  const handleExportResult = async (result: EditorResult) => {
    const exportData = {
      metadata: {
        exportedAt: new Date().toISOString(),
        version: result.version,
        mode: result.mode,
        factCheckId: factCheckReport.id
      },
      original: {
        text: result.originalText,
        factCheckScore: factCheckReport.final_score,
        verdict: factCheckReport.final_verdict
      },
      enhanced: {
        text: result.editedText,
        improvementScore: result.improvementScore,
        confidence: result.confidence,
        changesApplied: result.changesApplied
      },
      analytics: {
        tokensUsed: result.tokensUsed,
        costEstimate: result.costEstimate,
        processingTime: result.processingTime
      }
    };

    let content: string;
    let filename: string;
    let mimeType: string;

    switch (exportFormat) {
      case 'markdown':
        content = generateMarkdownExport(exportData);
        filename = `truescope-${result.mode}-${Date.now()}.md`;
        mimeType = 'text/markdown';
        break;
      case 'txt':
        content = generateTextExport(exportData);
        filename = `truescope-${result.mode}-${Date.now()}.txt`;
        mimeType = 'text/plain';
        break;
      default:
        content = JSON.stringify(exportData, null, 2);
        filename = `truescope-${result.mode}-${Date.now()}.json`;
        mimeType = 'application/json';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const generateMarkdownExport = (data: any) => {
    return `# TruScope AI Enhanced Content

## Metadata
- **Exported:** ${data.metadata.exportedAt}
- **Mode:** ${data.metadata.mode}
- **Version:** ${data.metadata.version}

## Original Analysis
- **Fact Check Score:** ${data.original.factCheckScore}/100
- **Verdict:** ${data.original.verdict}

## Original Content
\`\`\`
${data.original.text}
\`\`\`

## Enhanced Content
\`\`\`
${data.enhanced.text}
\`\`\`

## Improvements
- **Improvement Score:** ${data.enhanced.improvementScore}/100
- **Confidence:** ${data.enhanced.confidence}%
- **Processing Time:** ${data.analytics.processingTime}ms
- **Tokens Used:** ${data.analytics.tokensUsed}
- **Cost Estimate:** $${data.analytics.costEstimate}

## Changes Applied
${data.enhanced.changesApplied.map((change: ContentChange) =>
  `- **${change.type}**: "${change.originalPhrase}" → "${change.newPhrase}" (${Math.round(change.confidence * 100)}% confidence)\n  *Reason: ${change.reason}*`
).join('\n')}
`;
  };

  const generateTextExport = (data: any) => {
    return `TruScope AI Enhanced Content Export
=====================================

Export Date: ${data.metadata.exportedAt}
Mode: ${data.metadata.mode}
Version: ${data.metadata.version}

ORIGINAL ANALYSIS
-----------------
Fact Check Score: ${data.original.factCheckScore}/100
Verdict: ${data.original.verdict}

ORIGINAL CONTENT
----------------
${data.original.text}

ENHANCED CONTENT
----------------
${data.enhanced.text}

ANALYTICS
---------
Improvement Score: ${data.enhanced.improvementScore}/100
Confidence: ${data.enhanced.confidence}%
Processing Time: ${data.analytics.processingTime}ms
Tokens Used: ${data.analytics.tokensUsed}
Cost Estimate: $${data.analytics.costEstimate}

CHANGES SUMMARY
---------------
${data.enhanced.changesApplied.map((change: ContentChange) =>
  `${change.type.toUpperCase()}: "${change.originalPhrase}" → "${change.newPhrase}"\nReason: ${change.reason}\nConfidence: ${Math.round(change.confidence * 100)}%\n`
).join('\n')}
`;
  };

  // Utility functions
  const getModeColor = (mode: string) => {
    const colors: { [key: string]: string } = {
      'quick-fix': 'bg-blue-500/20 border-blue-500/30 text-blue-300',
      'enhanced': 'bg-purple-500/20 border-purple-500/30 text-purple-300',
      'complete-rewrite': 'bg-green-500/20 border-green-500/30 text-green-300',
      'seo-optimized': 'bg-orange-500/20 border-orange-500/30 text-orange-300',
      'academic': 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300',
      'expansion': 'bg-pink-500/20 border-pink-500/30 text-pink-300'
    };
    return colors[mode] || 'bg-slate-500/20 border-slate-500/30 text-slate-300';
  };

  const isProcessing = (mode: string) => {
    const job = processingJobs[mode];
    return job?.status === 'processing' || job?.status === 'queued';
  };

  const getProcessingProgress = (mode: string) => {
    return processingJobs[mode]?.progress || 0;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-7xl max-h-[95vh] m-4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div>
            <h2 className="text-2xl font-bold text-slate-100">TruScope AI - Advanced Content Editor</h2>
            <p className="text-slate-300 text-sm">Industry-standard content enhancement with AI</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as any)}
              className="bg-slate-700 border border-slate-600 rounded px-3 py-1 text-slate-200 text-sm"
            >
              <option value="json">JSON Export</option>
              <option value="markdown">Markdown</option>
              <option value="txt">Plain Text</option>
            </select>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-700">
          {(['selector', 'results', 'comparison', 'history'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 font-medium text-sm transition-colors capitalize ${
                activeTab === tab
                  ? 'text-indigo-400 border-b-2 border-indigo-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              disabled={tab === 'results' && Object.keys(editorResults).length === 0}
            >
              {tab === 'selector' && 'Mode Selection'}
              {tab === 'results' && `Results (${Object.keys(editorResults).length})`}
              {tab === 'comparison' && 'Compare'}
              {tab === 'history' && 'Version History'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'selector' && (
            <div className="space-y-6">
              {/* Custom Instructions */}
              <div className="bg-slate-700/50 p-4 rounded-lg">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Custom Instructions (Optional)
                </label>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Add specific instructions for the AI editor..."
                  className="w-full h-24 p-3 bg-slate-800 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-400 resize-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {/* Batch Processing */}
              <div className="flex gap-3">
                <button
                  onClick={handleBatchProcess}
                  disabled={batchProcessingStatus === 'processing'}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center gap-2"
                >
                  {batchProcessingStatus === 'processing' ? (
                    <>
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Processing Batch...
                    </>
                  ) : (
                    <>⚡ Process Top 3 Modes</>
                  )}
                </button>

                {batchProcessingStatus === 'completed' && (
                  <div className="flex items-center text-green-400">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    Batch completed!
                  </div>
                )}
              </div>

              {/* Editor Modes Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {editorModes.map((mode) => (
                  <div
                    key={mode.id}
                    className={`p-4 rounded-lg border transition-all hover:scale-105 ${getModeColor(mode.id)}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="text-2xl">{mode.icon}</div>
                      <div className="flex flex-col items-end text-xs">
                        <span className={`px-2 py-1 rounded-full ${
                          mode.costTier === 'low' ? 'bg-green-500/20 text-green-300' :
                          mode.costTier === 'medium' ? 'bg-yellow-500/20 text-yellow-300' :
                          'bg-red-500/20 text-red-300'
                        }`}>
                          {mode.costTier} cost
                        </span>
                        <span className="mt-1 text-slate-400">{mode.processingTime}</span>
                      </div>
                    </div>

                    <h3 className="font-semibold text-lg mb-2">{mode.name}</h3>
                    <p className="text-sm text-slate-300 mb-4 line-clamp-3">{mode.description}</p>

                    {/* Processing Progress */}
                    {isProcessing(mode.id) && (
                      <div className="mb-3">
                        <div className="w-full bg-slate-700 rounded-full h-2">
                          <div
                            className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${getProcessingProgress(mode.id)}%` }}
                          />
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          Processing... {Math.round(getProcessingProgress(mode.id))}%
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleIndividualModeProcess(mode.id)}
                        disabled={isProcessing(mode.id)}
                        className="flex-1 bg-slate-600 hover:bg-slate-500 disabled:bg-slate-700 text-white font-medium py-2 px-3 rounded transition-colors text-sm"
                      >
                        {isProcessing(mode.id) ? 'Processing...' :
                         editorResults[mode.id] ? 'Reprocess' : 'Process'}
                      </button>
                      {editorResults[mode.id] && (
                        <button
                          onClick={() => {
                            setSelectedMode(mode.id);
                            setActiveTab('results');
                          }}
                          className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors text-sm"
                        >
                          View
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'results' && Object.keys(editorResults).length > 0 && (
            <div className="space-y-6">
              {/* Results Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(editorResults).map(([mode, result]: [string, EditorResult]) => (
                  <div key={mode} className={`p-4 rounded-lg border ${getModeColor(mode)}`}>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl">{editorModes.find(m => m.id === mode)?.icon}</span>
                      <div>
                        <h3 className="font-semibold">{editorModes.find(m => m.id === mode)?.name}</h3>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-green-300">Score: {result.improvementScore}/100</span>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-400">${result.costEstimate}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedMode(mode)}
                        className="flex-1 bg-slate-600 hover:bg-slate-500 text-white font-medium py-2 px-3 rounded transition-colors text-sm"
                      >
                        View Details
                      </button>
                      <button
                        onClick={() => handleExportResult(result)}
                        className="px-3 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded transition-colors text-sm"
                      >
                        Export
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Selected Result Details */}
              {selectedMode && editorResults[selectedMode] && (
                <div className="bg-slate-700/50 p-6 rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold text-slate-100">
                      {editorModes.find(m => m.id === selectedMode)?.name} Result
                    </h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => navigator.clipboard.writeText(editorResults[selectedMode]!.editedText)}
                        className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-slate-200 rounded transition-colors"
                      >
                        Copy Text
                      </button>
                      <button
                        onClick={() => handleExportResult(editorResults[selectedMode]!)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors"
                      >
                        Export Full Result
                      </button>
                    </div>
                  </div>

                  {/* Enhanced Result Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                    <div className="text-center p-3 bg-slate-800/50 rounded">
                      <div className="text-2xl font-bold text-green-400">
                        {editorResults[selectedMode]!.improvementScore}
                      </div>
                      <div className="text-xs text-slate-400">Improvement Score</div>
                    </div>
                    <div className="text-center p-3 bg-slate-800/50 rounded">
                      <div className="text-2xl font-bold text-blue-400">
                        {editorResults[selectedMode]!.changesApplied.length}
                      </div>
                      <div className="text-xs text-slate-400">Changes Applied</div>
                    </div>
                    <div className="text-center p-3 bg-slate-800/50 rounded">
                      <div className="text-2xl font-bold text-purple-400">
                        {Math.round(editorResults[selectedMode]!.confidence)}%
                      </div>
                      <div className="text-xs text-slate-400">Confidence</div>
                    </div>
                    <div className="text-center p-3 bg-slate-800/50 rounded">
                      <div className="text-2xl font-bold text-orange-400">
                        {editorResults[selectedMode]!.tokensUsed}
                      </div>
                      <div className="text-xs text-slate-400">Tokens Used</div>
                    </div>
                    <div className="text-center p-3 bg-slate-800/50 rounded">
                      <div className="text-2xl font-bold text-pink-400">
                        ${editorResults[selectedMode]!.costEstimate}
                      </div>
                      <div className="text-xs text-slate-400">Est. Cost</div>
                    </div>
                  </div>

                  {/* Enhanced Content */}
                  <div>
                    <h4 className="text-lg font-semibold text-slate-100 mb-3">Enhanced Content</h4>
                    <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-600">
                      <pre className="whitespace-pre-wrap text-slate-200 text-sm leading-relaxed">
                        {editorResults[selectedMode]!.editedText}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'comparison' && Object.keys(editorResults).length > 0 && (
            <div className="space-y-6">
              {/* Preview Mode Selector */}
              <div className="flex items-center gap-4 mb-4">
                <label className="text-sm font-medium text-slate-300">Preview Mode:</label>
                <div className="flex bg-slate-700 rounded-lg p-1">
                  {(['split', 'overlay', 'tabs'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setPreviewMode(mode)}
                      className={`px-3 py-1 text-sm rounded transition-colors capitalize ${
                        previewMode === mode
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {previewMode === 'split' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-100 mb-3">Original Content</h3>
                    <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-600 h-96 overflow-y-auto">
                      <pre className="whitespace-pre-wrap text-slate-300 text-sm leading-relaxed">
                        {originalText}
                      </pre>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-lg font-semibold text-slate-100">Enhanced Content</h3>
                      <select
                        value={selectedMode}
                        onChange={(e) => setSelectedMode(e.target.value)}
                        className="bg-slate-700 border border-slate-600 rounded px-3 py-1 text-slate-200 text-sm"
                      >
                        {Object.keys(editorResults).map((mode) => (
                          <option key={mode} value={mode}>
                            {editorModes.find(m => m.id === mode)?.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-600 h-96 overflow-y-auto">
                      <pre className="whitespace-pre-wrap text-slate-200 text-sm leading-relaxed">
                        {selectedMode && editorResults[selectedMode]
                          ? editorResults[selectedMode]!.editedText
                          : 'Select a mode to view enhanced content'
                        }
                      </pre>
                    </div>
                  </div>
                </div>
              )}

              {previewMode === 'overlay' && (
                <div className="relative">
                  <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-600 h-96 overflow-y-auto">
                    <div className="flex items-center gap-3 mb-4">
                      <button
                        onClick={() => setPreviewMode('split')}
                        className="text-slate-400 hover:text-slate-200"
                      >
                        Show Original
                      </button>
                      <select
                        value={selectedMode}
                        onChange={(e) => setSelectedMode(e.target.value)}
                        className="bg-slate-700 border border-slate-600 rounded px-3 py-1 text-slate-200 text-sm"
                      >
                        {Object.keys(editorResults).map((mode) => (
                          <option key={mode} value={mode}>
                            {editorModes.find(m => m.id === mode)?.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <pre className="whitespace-pre-wrap text-slate-200 text-sm leading-relaxed">
                      {selectedMode && editorResults[selectedMode]
                        ? editorResults[selectedMode]!.editedText
                        : originalText
                      }
                    </pre>
                  </div>
                </div>
              )}

              {previewMode === 'tabs' && (
                <div className="bg-slate-900/50 rounded-lg border border-slate-600">
                  <div className="flex border-b border-slate-700">
                    <button
                      onClick={() => setSelectedMode('original')}
                      className={`px-4 py-3 text-sm font-medium ${
                        selectedMode === 'original'
                          ? 'text-indigo-400 border-b-2 border-indigo-400'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Original
                    </button>
                    {Object.keys(editorResults).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setSelectedMode(mode)}
                        className={`px-4 py-3 text-sm font-medium ${
                          selectedMode === mode
                            ? 'text-indigo-400 border-b-2 border-indigo-400'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {editorModes.find(m => m.id === mode)?.name}
                      </button>
                    ))}
                  </div>
                  <div className="p-4 h-96 overflow-y-auto">
                    <pre className="whitespace-pre-wrap text-slate-200 text-sm leading-relaxed">
                      {selectedMode === 'original'
                        ? originalText
                        : selectedMode && editorResults[selectedMode]
                        ? editorResults[selectedMode]!.editedText
                        : 'Select a mode to view content'
                      }
                    </pre>
                  </div>
                </div>
              )}

              {/* Changes Summary */}
              {selectedMode && selectedMode !== 'original' && editorResults[selectedMode] && (
                <div className="bg-slate-700/50 p-4 rounded-lg">
                  <h4 className="text-lg font-semibold text-slate-100 mb-3">Changes Applied</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {editorResults[selectedMode]!.changesApplied.map((change, index) => (
                      <div key={index} className="flex items-start gap-3 p-3 bg-slate-800/50 rounded">
                        <span className={`px-2 py-1 text-xs font-semibold rounded ${
                          change.type === 'addition' ? 'bg-green-500/20 text-green-300' :
                          change.type === 'deletion' ? 'bg-red-500/20 text-red-300' :
                          change.type === 'modification' ? 'bg-yellow-500/20 text-yellow-300' :
                          'bg-blue-500/20 text-blue-300'
                        }`}>
                          {change.type}
                        </span>
                        <div className="flex-1 text-sm">
                          <p className="text-slate-200 font-medium">"{change.originalPhrase}"</p>
                          {change.newPhrase && (
                            <p className="text-slate-300 mt-1">→ "{change.newPhrase}"</p>
                          )}
                          <p className="text-slate-400 text-xs mt-1">{change.reason}</p>
                        </div>
                        <div className="text-xs text-slate-400">
                          {Math.round(change.confidence * 100)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-100">Version History</h3>
                <div className="text-sm text-slate-400">
                  Total versions saved: {Object.values(savedVersions).reduce((sum: number, versions: EditorResult[]) => sum + versions.length, 0)}
                </div>
              </div>

              {Object.entries(savedVersions).map(([mode, versions]: [string, EditorResult[]]) => (
                <div key={mode} className="bg-slate-700/50 p-4 rounded-lg">
                  <h4 className="font-semibold text-slate-200 mb-3 flex items-center gap-2">
                    <span className="text-xl">{editorModes.find(m => m.id === mode)?.icon}</span>
                    {editorModes.find(m => m.id === mode)?.name} History ({versions.length} versions)
                  </h4>

                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {versions.map((version: EditorResult, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-slate-800/50 rounded">
                        <div>
                          <div className="text-sm text-slate-200 font-medium">
                            Version {version.version}
                          </div>
                          <div className="text-xs text-slate-400">
                            Score: {version.improvementScore}/100 •
                            Confidence: {version.confidence}% •
                            Cost: ${version.costEstimate}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditorResults(prev => ({...prev, [mode]: version}));
                              setSelectedMode(mode);
                              setActiveTab('results');
                            }}
                            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded transition-colors"
                          >
                            Load
                          </button>
                          <button
                            onClick={() => handleExportResult(version)}
                            className="px-3 py-1 bg-slate-600 hover:bg-slate-500 text-white text-sm rounded transition-colors"
                          >
                            Export
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {Object.keys(savedVersions).length === 0 && (
                <div className="text-center py-12 text-slate-400">
                  <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="text-lg font-semibold text-slate-300">No Version History</h3>
                  <p>Process some content to see version history here.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AutoEditor;
