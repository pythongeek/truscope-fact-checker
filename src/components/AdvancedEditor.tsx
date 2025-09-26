import React, { useState, useRef, useEffect } from 'react';
import { EditorMode, EditorConfig, EditorResult, ContentChange } from '../types/advancedEditor';
import { FactCheckReport } from '../types/factCheck';
import { SmartCorrection } from '../types/corrections';

interface AdvancedEditorProps {
  factCheckReport?: FactCheckReport;
  corrections?: SmartCorrection[];
  isOpen: boolean;
  onClose: () => void;
}

const EDITOR_CONFIGS: EditorConfig[] = [
  {
    id: 'quick-fix',
    name: 'Quick Fix',
    description: 'Fast grammar, spelling, and clarity improvements',
    prompt: 'Fix grammar, spelling, and improve clarity while preserving the original meaning and structure.',
    expectedOutputLength: 'preserve',
    processingTime: 'fast',
    costTier: 'low'
  },
  {
    id: 'enhanced',
    name: 'Enhanced',
    description: 'Comprehensive editing with style improvements',
    prompt: 'Enhance the text with better word choice, sentence structure, and flow while maintaining the original voice.',
    expectedOutputLength: 'expand',
    processingTime: 'medium',
    costTier: 'medium'
  },
  {
    id: 'complete-rewrite',
    name: 'Complete Rewrite',
    description: 'Full restructuring for maximum impact',
    prompt: 'Completely rewrite the text for maximum clarity, engagement, and professional polish.',
    expectedOutputLength: 'comprehensive',
    processingTime: 'slow',
    costTier: 'high'
  }
];

export const AdvancedEditor: React.FC<AdvancedEditorProps> = ({
  factCheckReport,
  corrections = [],
  isOpen,
  onClose
}) => {
  const [selectedMode, setSelectedMode] = useState<EditorMode>('quick-fix');
  const [originalText, setOriginalText] = useState('');
  const [editedText, setEditedText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<EditorResult | null>(null);
  const [error, setError] = useState<string | null>(null);
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

    // Apply corrections in reverse order to maintain position indices
    corrections
      .sort((a, b) => b.specificIssues[0]?.startIndex - a.specificIssues[0]?.startIndex)
      .forEach((correction, index) => {
        const issue = correction.specificIssues[0];
        if (issue && issue.suggestedFix) {
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
            position: { start: issue.startIndex, end: issue.endIndex }
          });
        }
      });

    return { correctedText, changes, hasChanges };
  };

  const generateChanges = (original: string, edited: string): ContentChange[] => {
    // Simple diff algorithm for demonstration
    // In production, you'd use a more sophisticated diff library
    const changes: ContentChange[] = [];

    if (original !== edited) {
      changes.push({
        type: 'modification',
        originalPhrase: original.substring(0, Math.min(50, original.length)) + '...',
        newPhrase: edited.substring(0, Math.min(50, edited.length)) + '...',
        reason: 'Content improved for clarity and accuracy',
        confidence: 85,
        position: { start: 0, end: original.length }
      });
    }

    return changes;
  };

  const processText = async (mode: EditorMode, text: string): Promise<EditorResult> => {
    const config = EDITOR_CONFIGS.find(c => c.id === mode);
    if (!config) throw new Error('Invalid editor mode');

    const startTime = Date.now();

    try {
      // First apply fact-checked corrections if available
      const { correctedText, changes: factCheckChanges, hasChanges: hasFactCheckChanges } =
        applyFactCheckedCorrections(text);

      let finalText = correctedText;
      let allChanges = [...factCheckChanges];

      // Only do AI processing if mode is not quick-fix or if no fact-check corrections were applied
      if (mode !== 'quick-fix' || !hasFactCheckChanges) {
        const response = await fetch('/api/advanced-editor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: correctedText,
            mode: mode,
            prompt: config.prompt
          })
        });

        if (!response.ok) {
          throw new Error(`Editor API failed: ${response.statusText}`);
        }

        const { editedText: aiEditedText } = await response.json();

        if (aiEditedText && aiEditedText !== correctedText) {
          finalText = aiEditedText;
          allChanges.push(...generateChanges(correctedText, aiEditedText));
        }
      }

      const processingTime = Date.now() - startTime;

      return {
        mode,
        originalText: text,
        editedText: finalText,
        changesApplied: allChanges,
        improvementScore: allChanges.length > 0 ? 85 : 100,
        processingTime,
        confidence: 90
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

    try {
      const result = await processText(selectedMode, originalText);
      setResult(result);
      setEditedText(result.editedText);

      // Check if no changes were made
      if (result.changesApplied.length === 0) {
        setError('No changes needed - your text is already well-written!');
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Editing failed:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const highlightChanges = (text: string, changes: ContentChange[]): React.ReactNode[] => {
    if (changes.length === 0) return [text];

    const elements: React.ReactNode[] = [];
    let lastIndex = 0;

    // Sort changes by position
    const sortedChanges = [...changes].sort((a, b) => a.position.start - b.position.start);

    sortedChanges.forEach((change, index) => {
      // Add text before the change
      if (lastIndex < change.position.start) {
        elements.push(
          <span key={`before-${index}`}>
            {text.substring(lastIndex, change.position.start)}
          </span>
        );
      }

      // Add the changed text with highlighting
      const changeClass = change.type === 'deletion' ? 'bg-red-100 text-red-800 line-through' :
                          change.type === 'addition' ? 'bg-green-100 text-green-800' :
                          'bg-blue-100 text-blue-800';

      elements.push(
        <span
          key={`change-${index}`}
          className={`${changeClass} px-1 rounded`}
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

  if (!isOpen) {
      return null;
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] m-4 flex flex-col">
        <div className="flex-shrink-0 flex items-center justify-between p-4 border-b">
          <h2 className="text-2xl font-bold text-gray-800">
            TruScope AI - Advanced Content Editor
          </h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-6">
                {/* Mode Selection */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {EDITOR_CONFIGS.map((config) => (
                    <div
                    key={config.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-all ${
                        selectedMode === config.id
                        ? 'border-blue-500 bg-blue-50 shadow-md'
                        : 'border-gray-300 hover:border-gray-400'
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
                    <p className="text-sm text-gray-600">{config.description}</p>
                    </div>
                ))}
                </div>

                {/* Text Input */}
                <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Original Text
                </label>
                <textarea
                    ref={textareaRef}
                    value={originalText}
                    onChange={(e) => setOriginalText(e.target.value)}
                    placeholder="Enter your text here..."
                    className="w-full h-40 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                </div>

                {/* Action Button */}
                <div className="flex justify-between items-center mb-6">
                <button
                    onClick={handleEdit}
                    disabled={isProcessing || !originalText.trim()}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                    {isProcessing ? 'Processing...' : `Apply ${selectedConfig?.name}`}
                </button>

                {corrections && corrections.length > 0 && (
                    <div className="text-sm text-blue-600">
                    📝 {corrections.length} fact-check correction(s) available
                    </div>
                )}
                </div>

                {/* Error Display */}
                {error && (
                <div className={`p-4 rounded-lg mb-6 ${
                    error.includes('No changes needed')
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Edited Text
                        {result.changesApplied.length > 0 && (
                        <span className="ml-2 text-xs text-gray-500">
                            ({result.changesApplied.length} change(s) made)
                        </span>
                        )}
                    </label>
                    <div className="p-4 border border-gray-300 rounded-lg bg-gray-50 min-h-40">
                        <div className="whitespace-pre-wrap leading-relaxed">
                        {highlightChanges(result.editedText, result.changesApplied)}
                        </div>
                    </div>
                    </div>

                    {/* Changes Summary */}
                    {result.changesApplied.length > 0 && (
                    <div>
                        <h3 className="font-medium text-gray-800 mb-3">Changes Applied</h3>
                        <div className="space-y-2">
                        {result.changesApplied.map((change, index) => (
                            <div key={index} className="p-3 bg-gray-50 rounded border-l-4 border-blue-500">
                            <div className="flex justify-between items-start mb-1">
                                <span className={`px-2 py-1 text-xs rounded ${
                                change.type === 'addition' ? 'bg-green-100 text-green-800' :
                                change.type === 'deletion' ? 'bg-red-100 text-red-800' :
                                change.type === 'modification' ? 'bg-blue-100 text-blue-800' :
                                'bg-gray-100 text-gray-800'
                                }`}>
                                {change.type}
                                </span>
                                <span className="text-xs text-gray-500">{change.confidence}% confidence</span>
                            </div>
                            <p className="text-sm text-gray-600 mb-1">{change.reason}</p>
                            {change.originalPhrase && change.newPhrase && (
                                <div className="text-xs">
                                <span className="text-red-600 line-through">{change.originalPhrase}</span>
                                <span className="mx-2">→</span>
                                <span className="text-green-600">{change.newPhrase}</span>
                                </div>
                            )}
                            </div>
                        ))}
                        </div>
                    </div>
                    )}

                    {/* Performance Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    </div>
                </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};