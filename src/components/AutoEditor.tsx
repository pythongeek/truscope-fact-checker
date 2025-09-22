import React, { useState, useEffect } from 'react';
import { FactCheckReport } from '../types/factCheck';
import { EditorMode, EditorConfig, EditorResult } from '../types/advancedEditor';
import { AdvancedCorrectorService } from '../services/advancedCorrector';

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
  const [selectedMode, setSelectedMode] = useState<EditorMode>('quick-fix');
  const [editorResults, setEditorResults] = useState<Map<EditorMode, EditorResult>>(new Map());
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'selector' | 'results' | 'comparison'>('selector');
  const [customPrompt, setCustomPrompt] = useState('');
  const [editorService] = useState(() => AdvancedCorrectorService.getInstance());

  const editorModes = editorService.getEditorModes();

  const handleModeProcess = async (mode: EditorMode) => {
    setIsProcessing(true);
    try {
      const result = await editorService.processContent(
        mode,
        originalText,
        factCheckReport,
        customPrompt || undefined
      );

      setEditorResults(prev => new Map(prev.set(mode, result)));
      setActiveTab('results');
    } catch (error) {
      console.error(`Failed to process ${mode}:`, error);
      alert(`Failed to process content in ${mode} mode. Please try again.`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBatchProcess = async () => {
    setIsProcessing(true);
    const modesConfig = [
      { mode: 'quick-fix' as EditorMode, priority: 1 },
      { mode: 'enhanced' as EditorMode, priority: 2 },
      { mode: 'seo-optimized' as EditorMode, priority: 3 }
    ];

    try {
      for (const { mode } of modesConfig) {
        const result = await editorService.processContent(
          mode,
          originalText,
          factCheckReport,
          customPrompt || undefined
        );
        setEditorResults(prev => new Map(prev.set(mode, result)));
      }
      setActiveTab('results');
    } catch (error) {
      console.error('Batch processing failed:', error);
      alert('Batch processing failed. Please try individual modes.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportResult = (result: EditorResult) => {
    const exportData = {
      mode: result.mode,
      originalText: result.originalText,
      editedText: result.editedText,
      improvementScore: result.improvementScore,
      processingTime: result.processingTime,
      timestamp: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jules-ai-${result.mode}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getModeIcon = (mode: EditorMode) => {
    const icons = {
      'quick-fix': '🔧',
      'enhanced': '✨',
      'complete-rewrite': '📝',
      'seo-optimized': '📊',
      'academic': '🎓',
      'expansion': '📈'
    };
    return icons[mode] || '⚙️';
  };

  const getModeColor = (mode: EditorMode) => {
    const colors = {
      'quick-fix': 'bg-blue-500/20 border-blue-500/30 text-blue-300',
      'enhanced': 'bg-purple-500/20 border-purple-500/30 text-purple-300',
      'complete-rewrite': 'bg-green-500/20 border-green-500/30 text-green-300',
      'seo-optimized': 'bg-orange-500/20 border-orange-500/30 text-orange-300',
      'academic': 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300',
      'expansion': 'bg-pink-500/20 border-pink-500/30 text-pink-300'
    };
    return colors[mode] || 'bg-slate-500/20 border-slate-500/30 text-slate-300';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-7xl max-h-[95vh] m-4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div>
            <h2 className="text-2xl font-bold text-slate-100">Jules AI - Advanced Content Editor</h2>
            <p className="text-slate-300 text-sm">Transform your content with AI-powered editing modes</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-700">
          <button
            onClick={() => setActiveTab('selector')}
            className={`px-6 py-3 font-medium text-sm transition-colors ${
              activeTab === 'selector'
                ? 'text-indigo-400 border-b-2 border-indigo-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Mode Selection
          </button>
          <button
            onClick={() => setActiveTab('results')}
            className={`px-6 py-3 font-medium text-sm transition-colors ${
              activeTab === 'results'
                ? 'text-indigo-400 border-b-2 border-indigo-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            disabled={editorResults.size === 0}
          >
            Results ({editorResults.size})
          </button>
          <button
            onClick={() => setActiveTab('comparison')}
            className={`px-6 py-3 font-medium text-sm transition-colors ${
              activeTab === 'comparison'
                ? 'text-indigo-400 border-b-2 border-indigo-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            disabled={editorResults.size === 0}
          >
            Side-by-Side Compare
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'selector' && (
            <div className="space-y-6">
              {/* Custom Prompt Section */}
              <div className="bg-slate-700/50 p-4 rounded-lg">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Custom Instructions (Optional)
                </label>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Add specific instructions for the AI editor (e.g., 'Focus on technical accuracy', 'Use a more conversational tone', 'Add more examples')..."
                  className="w-full h-24 p-3 bg-slate-800 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-400 resize-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {/* Batch Processing */}
              <div className="flex gap-3">
                <button
                  onClick={handleBatchProcess}
                  disabled={isProcessing}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Processing...
                    </>
                  ) : (
                    <>
                      ⚡ Process Top 3 Modes
                    </>
                  )}
                </button>
              </div>

              {/* Editor Modes Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {editorModes.map((config) => (
                  <div
                    key={config.id}
                    className={`p-4 rounded-lg border transition-all hover:scale-105 cursor-pointer ${getModeColor(config.id)}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="text-2xl">{getModeIcon(config.id)}</div>
                      <div className="flex flex-col items-end text-xs">
                        <span className={`px-2 py-1 rounded-full ${
                          config.costTier === 'low' ? 'bg-green-500/20 text-green-300' :
                          config.costTier === 'medium' ? 'bg-yellow-500/20 text-yellow-300' :
                          'bg-red-500/20 text-red-300'
                        }`}>
                          {config.costTier} cost
                        </span>
                        <span className="mt-1 text-slate-400">{config.processingTime}</span>
                      </div>
                    </div>

                    <h3 className="font-semibold text-lg mb-2">{config.name}</h3>
                    <p className="text-sm text-slate-300 mb-4 line-clamp-3">{config.description}</p>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleModeProcess(config.id)}
                        disabled={isProcessing}
                        className="flex-1 bg-slate-600 hover:bg-slate-500 disabled:bg-slate-700 text-white font-medium py-2 px-3 rounded transition-colors text-sm"
                      >
                        {editorResults.has(config.id) ? 'Reprocess' : 'Process'}
                      </button>
                      {editorResults.has(config.id) && (
                        <button
                          onClick={() => setSelectedMode(config.id)}
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

          {activeTab === 'results' && editorResults.size > 0 && (
            <div className="space-y-6">
              {/* Results Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Array.from(editorResults.entries()).map(([mode, result]) => (
                  <div key={mode} className={`p-4 rounded-lg border ${getModeColor(mode)}`}>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl">{getModeIcon(mode)}</span>
                      <div>
                        <h3 className="font-semibold">{editorService.getEditorConfig(mode).name}</h3>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-green-300">Score: {result.improvementScore}/100</span>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-400">{result.processingTime}ms</span>
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
              {selectedMode && editorResults.has(selectedMode) && (
                <div className="bg-slate-700/50 p-6 rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold text-slate-100">
                      {editorService.getEditorConfig(selectedMode).name} Result
                    </h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => navigator.clipboard.writeText(editorResults.get(selectedMode)!.editedText)}
                        className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-slate-200 rounded transition-colors"
                      >
                        Copy Text
                      </button>
                      <button
                        onClick={() => handleExportResult(editorResults.get(selectedMode)!)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors"
                      >
                        Export Full Result
                      </button>
                    </div>
                  </div>

                  {/* Result Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="text-center p-3 bg-slate-800/50 rounded">
                      <div className="text-2xl font-bold text-green-400">
                        {editorResults.get(selectedMode)!.improvementScore}
                      </div>
                      <div className="text-xs text-slate-400">Improvement Score</div>
                    </div>
                    <div className="text-center p-3 bg-slate-800/50 rounded">
                      <div className="text-2xl font-bold text-blue-400">
                        {editorResults.get(selectedMode)!.changesApplied.length}
                      </div>
                      <div className="text-xs text-slate-400">Changes Applied</div>
                    </div>
                    <div className="text-center p-3 bg-slate-800/50 rounded">
                      <div className="text-2xl font-bold text-purple-400">
                        {Math.round(editorResults.get(selectedMode)!.confidence * 100)}%
                      </div>
                      <div className="text-xs text-slate-400">Confidence</div>
                    </div>
                    <div className="text-center p-3 bg-slate-800/50 rounded">
                      <div className="text-2xl font-bold text-orange-400">
                        {editorResults.get(selectedMode)!.processingTime}ms
                      </div>
                      <div className="text-xs text-slate-400">Processing Time</div>
                    </div>
                  </div>

                  {/* Edited Content */}
                  <div>
                    <h4 className="text-lg font-semibold text-slate-100 mb-3">Enhanced Content</h4>
                    <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-600">
                      <pre className="whitespace-pre-wrap text-slate-200 text-sm leading-relaxed">
                        {editorResults.get(selectedMode)!.editedText}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'comparison' && editorResults.size > 0 && (
            <div className="space-y-6">
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
                      onChange={(e) => setSelectedMode(e.target.value as EditorMode)}
                      className="bg-slate-700 border border-slate-600 rounded px-3 py-1 text-slate-200 text-sm"
                    >
                      {Array.from(editorResults.keys()).map((mode) => (
                        <option key={mode} value={mode}>
                          {editorService.getEditorConfig(mode).name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-600 h-96 overflow-y-auto">
                    <pre className="whitespace-pre-wrap text-slate-200 text-sm leading-relaxed">
                      {selectedMode && editorResults.has(selectedMode)
                        ? editorResults.get(selectedMode)!.editedText
                        : 'Select a mode to view enhanced content'
                      }
                    </pre>
                  </div>
                </div>
              </div>

              {/* Changes Summary */}
              {selectedMode && editorResults.has(selectedMode) && (
                <div className="bg-slate-700/50 p-4 rounded-lg">
                  <h4 className="text-lg font-semibold text-slate-100 mb-3">Changes Applied</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {editorResults.get(selectedMode)!.changesApplied.map((change, index) => (
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
        </div>
      </div>
    </div>
  );
};

export default AutoEditor;
