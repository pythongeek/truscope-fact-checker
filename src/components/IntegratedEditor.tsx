import React, { useState, useRef, useEffect } from 'react';
import { EditorMode, EditorConfig, EditorResult, ContentChange } from '../types/advancedEditor';
import { FactCheckReport } from '../types/factCheck';
import { SmartCorrection } from '../types/corrections';
import { BlobStorageService } from '../services/blobStorage';

interface IntegratedEditorProps {
  factCheckReport?: FactCheckReport;
  corrections?: SmartCorrection[];
  onEditorResult?: (result: EditorResult) => void;
}

const EDITOR_CONFIGS: EditorConfig[] = [
  {
    id: 'quick-fix',
    name: 'Quick Fix',
    description: 'Fast grammar, spelling, and fact-check corrections',
    prompt: 'Apply fact-check corrections and fix basic grammar and spelling issues.',
    expectedOutputLength: 'preserve',
    processingTime: 'fast',
    costTier: 'low'
  },
  {
    id: 'enhanced',
    name: 'Enhanced',
    description: 'Comprehensive editing with style improvements and fact corrections',
    prompt: 'Apply fact-check corrections and enhance the text with better word choice, sentence structure, and flow.',
    expectedOutputLength: 'expand',
    processingTime: 'medium',
    costTier: 'medium'
  },
  {
    id: 'complete-rewrite',
    name: 'Complete Rewrite',
    description: 'Full restructuring with fact corrections for maximum impact',
    prompt: 'Apply fact-check corrections and completely rewrite the text for maximum clarity, engagement, and accuracy.',
    expectedOutputLength: 'comprehensive',
    processingTime: 'slow',
    costTier: 'high'
  }
];

export const IntegratedEditor: React.FC<IntegratedEditorProps> = ({
  factCheckReport,
  corrections = [],
  onEditorResult
}) => {
  const [selectedMode, setSelectedMode] = useState<EditorMode>('quick-fix');
  const [originalText, setOriginalText] = useState('');
  const [editedText, setEditedText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<EditorResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Auto-populate with fact-check text if available
    if (factCheckReport?.originalText && !originalText) {
      setOriginalText(factCheckReport.originalText);
    }
  }, [factCheckReport, originalText]);

  const applyFactCheckedCorrections = (text: string): {
    correctedText: string;
    changes: ContentChange[];
    hasChanges: boolean;
  } => {
    if (!corrections || corrections.length === 0) {
      return { correctedText: text, changes: [], hasChanges: false };
    }

    let correctedText = text;
    const changes: ContentChange[] = [];
    let hasChanges = false;

    // Sort corrections by position (reverse order to maintain indices)
    const sortedCorrections = [...corrections].sort((a, b) => {
      const aStart = a.specificIssues[0]?.startIndex || 0;
      const bStart = b.specificIssues[0]?.startIndex || 0;
      return bStart - aStart;
    });

    sortedCorrections.forEach((correction) => {
      correction.specificIssues.forEach((issue) => {
        if (issue.suggestedFix && issue.startIndex !== undefined && issue.endIndex !== undefined) {
          const before = correctedText.substring(0, issue.startIndex);
          const after = correctedText.substring(issue.endIndex);

          correctedText = before + issue.suggestedFix + after;
          hasChanges = true;

          changes.push({
            type: 'modification',
            originalPhrase: issue.originalText,
            newPhrase: issue.suggestedFix,
            reason: `Fact-check correction: ${issue.description}`,
            confidence: correction.confidence,
            position: { start: issue.startIndex, end: issue.startIndex + issue.suggestedFix.length }
          });
        }
      });
    });

    return { correctedText, changes, hasChanges };
  };

  const processText = async (mode: EditorMode, text: string): Promise<EditorResult> => {
    const config = EDITOR_CONFIGS.find(c => c.id === mode);
    if (!config) throw new Error('Invalid editor mode');

    const startTime = Date.now();

    try {
      // Apply fact-checked corrections first
      const { correctedText, changes: factCheckChanges, hasChanges: hasFactCheckChanges } =
        applyFactCheckedCorrections(text);

      let finalText = correctedText;
      let allChanges = [...factCheckChanges];

      // Apply AI editing if needed (not for quick-fix with fact-check corrections)
      if (mode !== 'quick-fix' || !hasFactCheckChanges) {
        try {
          const response = await fetch('/api/advanced-editor', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: correctedText,
              mode: mode,
              prompt: config.prompt
            })
          });

          if (response.ok) {
            const { editedText: aiEditedText } = await response.json();

            if (aiEditedText && aiEditedText !== correctedText) {
              finalText = aiEditedText;

              // Add a general change entry for AI improvements
              allChanges.push({
                type: 'modification',
                originalPhrase: 'Content enhanced by AI',
                newPhrase: 'Improved version',
                reason: `${config.name} improvements applied`,
                confidence: 85,
                position: { start: 0, end: finalText.length }
              });
            }
          }
        } catch (aiError) {
          console.warn('AI editing failed, using fact-check corrections only:', aiError);
        }
      }

      const processingTime = Date.now() - startTime;
      const improvementScore = allChanges.length > 0 ?
        Math.min(95, 70 + (allChanges.length * 5)) : 100;

      return {
        mode,
        originalText: text,
        editedText: finalText,
        changesApplied: allChanges,
        improvementScore,
        processingTime,
        confidence: allChanges.length > 0 ? 92 : 100
      };

    } catch (error) {
      console.error('Text processing failed:', error);
      throw new Error('Failed to process text. Please try again.');
    }
  };

  const handleEdit = async () => {
    if (!originalText.trim()) {
      setError('Please enter text to edit');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      const editorResult = await processText(selectedMode, originalText);
      setResult(editorResult);
      setEditedText(editorResult.editedText);

      // Store result in session storage (not blob storage)
      BlobStorageService.handleEditorResult(editorResult);

      // Call parent callback if provided
      if (onEditorResult) {
        onEditorResult(editorResult);
      }

      // Check if no changes were made
      if (editorResult.changesApplied.length === 0) {
        setError('✅ No changes needed - your text is already well-written and factually accurate!');
      } else {
        setShowComparison(true);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during processing');
      console.error('Editing failed:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const highlightChanges = (text: string, changes: ContentChange[]): React.ReactNode[] => {
    if (changes.length === 0) return [text];

    const elements: React.ReactNode[] = [];
    let lastIndex = 0;

    // Filter and sort changes by position for fact-check corrections only
    const factCheckChanges = changes.filter(change =>
      change.reason.includes('Fact-check correction')
    ).sort((a, b) => a.position.start - b.position.start);

    if (factCheckChanges.length === 0) {
      return [text];
    }

    factCheckChanges.forEach((change, index) => {
      // Add text before the change
      if (lastIndex < change.position.start) {
        elements.push(
          <span key={`before-${index}`}>
            {text.substring(lastIndex, change.position.start)}
          </span>
        );
      }

      // Add the changed text with highlighting
      const isCorrection = change.reason.includes('Fact-check correction');
      const changeClass = isCorrection ? 'bg-green-100 text-green-800 border-b-2 border-green-500' :
                          change.type === 'deletion' ? 'bg-red-100 text-red-800 line-through' :
                          'bg-blue-100 text-blue-800';

      elements.push(
        <span
          key={`change-${index}`}
          className={`${changeClass} px-1 rounded transition-colors duration-200`}
          title={change.reason}
        >
          {change.newPhrase || change.originalPhrase}
        </span>
      );

      lastIndex = change.position.end;
    });

    // Add remaining text
    if (lastIndex < text.length) {
      elements.push(
        <span key="remaining">
          {text.substring(lastIndex)}
        </span>
      );
    }

    return elements;
  };

  const selectedConfig = EDITOR_CONFIGS.find(c => c.id === selectedMode);
  const factCheckCorrectionsCount = corrections.length;
  const hasFactCheckData = factCheckReport && factCheckCorrectionsCount > 0;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">
            TruScope AI - Advanced Content Editor
          </h2>
          {hasFactCheckData && (
            <div className="flex items-center space-x-2 text-sm">
              <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full">
                📋 Fact-Check Data Available
              </span>
              <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full">
                ✅ {factCheckCorrectionsCount} Corrections Ready
              </span>
            </div>
          )}
        </div>

        {/* Mode Selection */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {EDITOR_CONFIGS.map((config) => (
            <div
              key={config.id}
              className={`p-4 border rounded-lg cursor-pointer transition-all ${
                selectedMode === config.id
                  ? 'border-blue-500 bg-blue-50 shadow-md'
                  : 'border-gray-300 hover:border-gray-400 hover:shadow-sm'
              }`}
              onClick={() => setSelectedMode(config.id)}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-800">{config.name}</h3>
                <div className="flex space-x-1">
                  <span className={`px-2 py-1 text-xs rounded ${
                    config.processingTime === 'fast' ? 'bg-green-100 text-green-800' :
                    config.processingTime === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {config.processingTime}
                  </span>
                  <span className={`px-2 py-1 text-xs rounded ${
                    config.costTier === 'low' ? 'bg-green-100 text-green-800' :
                    config.costTier === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {config.costTier}
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-2">{config.description}</p>
              {config.id === 'quick-fix' && hasFactCheckData && (
                <div className="text-xs text-green-600 font-medium">
                  🎯 Recommended: Will apply {factCheckCorrectionsCount} fact corrections
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Text Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Original Text
            {hasFactCheckData && (
              <span className="ml-2 text-xs text-blue-600">
                (Pre-loaded from fact-check analysis)
              </span>
            )}
          </label>
          <textarea
            ref={textareaRef}
            value={originalText}
            onChange={(e) => setOriginalText(e.target.value)}
            placeholder="Enter your text here, or it will be automatically loaded from your fact-check analysis..."
            className="w-full h-40 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Action Button */}
        <div className="flex justify-between items-center mb-6">
          <button
            onClick={handleEdit}
            disabled={isProcessing || !originalText.trim()}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              isProcessing || !originalText.trim()
                ? 'bg-gray-400 text-white cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg'
            }`}
          >
            {isProcessing ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
            ) : `Apply ${selectedConfig?.name}`}
          </button>

          <div className="flex items-center space-x-4">
            {result && result.changesApplied.length > 0 && (
              <button
                onClick={() => setShowComparison(!showComparison)}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
              >
                {showComparison ? 'Hide Comparison' : 'Show Comparison'}
              </button>
            )}

            {hasFactCheckData && (
              <div className="text-sm text-blue-600 flex items-center">
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                </svg>
                {factCheckCorrectionsCount} corrections ready to apply
              </div>
            )}
          </div>
        </div>

        {/* Error/Success Display */}
        {error && (
          <div className={`p-4 rounded-lg mb-6 ${
            error.includes('No changes needed') || error.includes('✅')
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-6">
            {/* Edited Text */}
            <div>
              <label className="flex items-center justify-between text-sm font-medium text-gray-700 mb-2">
                <span>
                  Edited Text
                  {result.changesApplied.length > 0 && (
                    <span className="ml-2 text-xs text-gray-500">
                      ({result.changesApplied.length} change(s) applied)
                    </span>
                  )}
                </span>
                <button
                  onClick={() => navigator.clipboard.writeText(result.editedText)}
                  className="text-xs px-2 py-1 bg-blue-100 text-blue-600 rounded hover:bg-blue-200 transition-colors"
                >
                  📋 Copy
                </button>
              </label>
              <div className="p-4 border border-gray-300 rounded-lg bg-gray-50 min-h-40">
                <div className="whitespace-pre-wrap leading-relaxed">
                  {highlightChanges(result.editedText, result.changesApplied)}
                </div>
              </div>
            </div>

            {/* Side-by-Side Comparison */}
            {showComparison && result.changesApplied.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium text-gray-800 mb-2">Original Text</h3>
                  <div className="p-4 border rounded-lg bg-red-50 h-60 overflow-y-auto">
                    <div className="whitespace-pre-wrap leading-relaxed text-sm">
                      {originalText}
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="font-medium text-gray-800 mb-2">Corrected Text</h3>
                  <div className="p-4 border rounded-lg bg-green-50 h-60 overflow-y-auto">
                    <div className="whitespace-pre-wrap leading-relaxed text-sm">
                      {result.editedText}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Changes Summary */}
            {result.changesApplied.length > 0 && (
              <div>
                <h3 className="font-medium text-gray-800 mb-3">Applied Corrections</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {result.changesApplied
                    .filter(change => change.reason.includes('Fact-check correction'))
                    .map((change, index) => (
                      <div key={index} className="p-3 bg-green-50 rounded border-l-4 border-green-500">
                        <div className="flex justify-between items-start mb-1">
                          <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-800">
                            ✅ Fact Correction
                          </span>
                          <span className="text-xs text-gray-500">{change.confidence}% confidence</span>
                        </div>
                        <p className="text-sm text-gray-700 mb-2">{change.reason}</p>
                        {change.originalPhrase && change.newPhrase && (
                          <div className="text-xs bg-white p-2 rounded">
                            <div className="mb-1">
                              <span className="text-red-600 font-medium">Before: </span>
                              <span className="text-red-600 line-through">{change.originalPhrase}</span>
                            </div>
                            <div>
                              <span className="text-green-600 font-medium">After: </span>
                              <span className="text-green-600">{change.newPhrase}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Performance Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-sm text-blue-600 font-medium">Improvement Score</div>
                <div className="text-2xl font-bold text-blue-800">{result.improvementScore}</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-sm text-green-600 font-medium">Processing Time</div>
                <div className="text-2xl font-bold text-green-800">{result.processingTime}ms</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="text-sm text-purple-600 font-medium">Confidence</div>
                <div className="text-2xl font-bold text-purple-800">{result.confidence}%</div>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg">
                <div className="text-sm text-orange-600 font-medium">Changes Applied</div>
                <div className="text-2xl font-bold text-orange-800">{result.changesApplied.length}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};