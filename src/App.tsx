import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import HistoryView from './components/HistoryView';
import SettingsModal from './components/SettingsModal';
import TrendingMisinformation from './components/TrendingMisinformation';
import { FactCheckInterface } from './components/FactCheckInterface';
import { FactCheckReport } from '@/types/factCheck';
import { parseAIJsonResponse } from './utils/jsonParser';

// Initialize the global JSON fix on app startup
function initializeGlobalJsonFix() {
  // Store the original JSON.parse method
  const originalJsonParse = JSON.parse;

  // Override JSON.parse globally to handle AI response parsing
  (JSON as any).parse = function(text: string, reviver?: (key: string, value: any) => any): any {
    try {
      // Try the original JSON.parse first
      return originalJsonParse.call(this, text, reviver);
    } catch (error) {
      // If original fails and the text looks like it might be an AI response
      if (typeof text === 'string' && (
        text.includes('```') ||
        text.includes('final_verdict') ||
        text.includes('score_breakdown') ||
        text.includes('enhanced_claim_text') ||
        text.trim().startsWith('```json') ||
        (text.includes('{') && text.includes('}') && text.includes('`'))
      )) {
        try {
          console.warn('[JSON Fix] Standard JSON.parse failed, attempting robust AI response parsing');
          const result = parseAIJsonResponse(text);
          console.log('[JSON Fix] Successfully parsed AI response');
          return result;
        } catch (robustError) {
          console.error('[JSON Fix] Robust parsing also failed:', robustError);
          console.error('[JSON Fix] Original text sample:', text.substring(0, 200));
          // If robust parsing also fails, throw the original error
          throw error;
        }
      }
      // For non-AI responses, throw the original error
      throw error;
    }
  };

  console.log('[JSON Fix] Global JSON parser override initialized for AI responses');
}


type View = 'checker' | 'history' | 'trending';

const App: React.FC = () => {
    // Add the useEffect hook to initialize the fix
    useEffect(() => {
        initializeGlobalJsonFix();
    }, []);

    const [currentView, setCurrentView] = useState<View>('checker');
    // These two states are now used to pass data from history to the checker
    const [selectedReport, setSelectedReport] = useState<FactCheckReport | null>(null);
    const [selectedClaim, setSelectedClaim] = useState('');
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const handleSelectReport = (report: FactCheckReport, claimText: string) => {
        setSelectedReport(report);
        setSelectedClaim(claimText);
        setCurrentView('checker');
    };

    const renderContent = () => {
        switch (currentView) {
            case 'checker':
                return (
                    <FactCheckInterface
                        initialReport={selectedReport}
                        initialClaimText={selectedClaim}
                    />
                );
            case 'history':
                return (
                    <div className="max-w-6xl mx-auto">
                        <HistoryView onSelectReport={handleSelectReport} />
                    </div>
                );
            case 'trending':
                return (
                    <div className="max-w-6xl mx-auto">
                        <TrendingMisinformation />
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100">
            <div className="flex">
                <Sidebar
                    onSettingsClick={() => setIsSettingsOpen(true)}
                    currentView={currentView}
                    onNavigate={setCurrentView}
                />

                <main className="flex-1 p-6 overflow-hidden">
                    {renderContent()}
                </main>
            </div>

            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
            />
        </div>
    );
};

export default App;