import React, { useState } from 'react';
import { CorrectionSuggestion } from '../types';
import { editorialOrchestrator, EditorialPackage } from '../services/EditorialOrchestrationService';

interface Props {
  initialText: string;
}

const AutoEditorTab: React.FC<Props> = ({ initialText }) => {
  const [editedText, setEditedText] = useState(initialText);
  const [suggestions, setSuggestions] = useState<CorrectionSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editorialPackage, setEditorialPackage] = useState<EditorialPackage | null>(null);

  const handleAnalyze = async () => {
    setIsLoading(true);
    try {
      // Corrected: Calling processText with only one argument as expected.
      const result = await editorialOrchestrator.processText(initialText);
      setEditorialPackage(result);
      setSuggestions(result.correctionSuggestions);
    } catch (error) {
      console.error("Failed to analyze text for suggestions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = (suggestionToAccept: CorrectionSuggestion) => {
    setEditedText(prev => prev.replace(suggestionToAccept.originalText, suggestionToAccept.suggestedText));
    setSuggestions(prev => prev.filter(s => s.originalText !== suggestionToAccept.originalText));
  };

  const handleReject = (suggestionToReject: CorrectionSuggestion) => {
    setSuggestions(prev => prev.filter(s => s.originalText !== suggestionToReject.originalText));
  };

  const buttonClasses = "px-4 py-2 rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400";
  const smallButtonClasses = "px-2 py-1 text-sm rounded-md text-white bg-green-600 hover:bg-green-700";
  const ghostButtonClasses = "px-2 py-1 text-sm rounded-md text-gray-700 bg-transparent hover:bg-gray-200";

  return (
    <div>
      <button onClick={handleAnalyze} disabled={isLoading || !initialText} className={buttonClasses}>
        {isLoading ? 'Analyzing...' : 'Analyze & Suggest Corrections'}
      </button>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
        <div>
          <h3 className="font-semibold mb-2">Editor</h3>
          <textarea
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            className="w-full h-96 p-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            aria-label="Edited text"
          />
        </div>
        <div>
          <h3 className="font-semibold mb-2">Suggestions ({suggestions.length})</h3>
          <div className="space-y-3 overflow-y-auto h-96 p-2 border rounded-md bg-gray-50">
            {suggestions.length > 0 ? (
              suggestions.map((s, index) => (
                <div key={index} className="p-3 border rounded-md bg-white shadow-sm">
                  <p className="text-sm text-red-600">Original: <del>{s.originalText}</del></p>
                  <p className="text-sm text-green-700">Suggestion: {s.suggestedText}</p>
                  <p className="text-xs mt-1 text-gray-600"><strong>Reason:</strong> {s.explanation}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <button className={smallButtonClasses} onClick={() => handleAccept(s)}>Accept</button>
                    <button className={ghostButtonClasses} onClick={() => handleReject(s)}>Reject</button>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                {isLoading ? 'Loading suggestions...' : 'No suggestions to display.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutoEditorTab;
