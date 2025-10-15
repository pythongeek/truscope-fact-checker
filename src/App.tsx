import React, { Suspense } from 'react';
import { Toaster } from 'sonner';
import { SettingsProvider } from './contexts/SettingsContext';
import { AppStateProvider, useAppState } from './contexts/AppStateContext';
import { TooltipProvider } from "@/components/ui/tooltip";
import DashboardSkeleton from './components/DashboardSkeleton';
import { FactCheckAssistant } from './components/FactCheckAssistant';

// Lazy-load the main platform component for better initial performance
const TruScopeJournalismPlatform = React.lazy(() => import('./components/TruScopeJournalismPlatform'));

/**
 * A new component to render the main application content and the AI assistant.
 * This allows us to access the AppStateContext to control the assistant's visibility.
 */
const AppContent: React.FC = () => {
  const { currentReport, isAssistantOpen, closeAssistant } = useAppState();

  return (
    <>
      <TruScopeJournalismPlatform />
      {currentReport && (
        <FactCheckAssistant
          report={currentReport}
          isOpen={isAssistantOpen}
          onClose={closeAssistant}
        />
      )}
    </>
  );
};

function App() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <SettingsProvider>
        <AppStateProvider>
          <TooltipProvider>
            <AppContent />
            <Toaster />
          </TooltipProvider>
        </AppStateProvider>
      </SettingsProvider>
    </Suspense>
  );
}

export default App;
