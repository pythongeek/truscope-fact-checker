// src/components/AutoEditorTab.tsx

import React, { useState } from 'react';
import { CorrectionSuggestion } from '../types/corrections';
import { editorialOrchestrator, EditorialPackage } from '../services/EditorialOrchestrationService';

interface Props {
  initialText: string;
}

const AutoEditorTab: React.FC<Props> = ({ initialText }) => {
  const [editedText, setEditedText] = useState(initialText);
  const [suggestions, setSuggestions] = useState<CorrectionSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // You can store the full package if you need the report/schema here too
  const [editorialPackage, setEditorialPackage] = useState<EditorialPackage | null>(null);

  const handleAnalyze = async () => {
    setIsLoading(true);
    const result = await editorialOrchestrator.processText(initialText);
    setEditorialPackage(result);
    setSuggestions(result.correctionSuggestions);
    setIsLoading(false);
  };

  const handleAccept = (suggestion: CorrectionSuggestion) => {
    // This logic replaces the original segment with the corrected one
    setEditedText(prev => prev.replace(suggestion.originalSegment, suggestion.suggestedCorrection));
    // Remove the suggestion from the list after it's been handled
    setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
  };

  const handleReject = (suggestionId: string) => {
    setSuggestions(prev => prev.filter(s => s.id !== suggestionId));
  };

  const buttonClasses = "px-4 py-2 rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400";
  const smallButtonClasses = "px-2 py-1 text-sm rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400";
  const ghostButtonClasses = "px-2 py-1 text-sm rounded-md text-gray-700 bg-transparent hover:bg-gray-200";

  return (
    <div>
      <button onClick={handleAnalyze} disabled={isLoading} className={buttonClasses}>
        {isLoading ? 'Analyzing...' : 'Analyze & Suggest Corrections'}
      </button>
      <div className="grid grid-cols-2 gap-6 mt-4">
        {/* Left Panel: The Text Editor */}
        <div>
          <h3 className="font-semibold mb-2">Editor</h3>
          <textarea
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            className="w-full h-96 p-2 border rounded"
          />
        </div>
        {/* Right Panel: The Suggestion List */}
        <div>
          <h3 className="font-semibold mb-2">Suggestions ({suggestions.length})</h3>
          <div className="space-y-3 overflow-y-auto h-96">
            {suggestions.map((s) => (
              <div key={s.id} className="p-3 border rounded-md bg-yellow-50">
                <p className="text-sm text-gray-500">Original: <del>{s.originalSegment}</del></p>
                <p className="text-sm text-green-700">Suggestion: {s.suggestedCorrection}</p>
                <p className="text-xs mt-1"><strong>Reason:</strong> {s.explanation}</p>
                <div className="mt-2">
                  <button className={smallButtonClasses} onClick={() => handleAccept(s)}>Accept</button>
                  <button className={ghostButtonClasses} onClick={() => handleReject(s.id)}>Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutoEditorTab;