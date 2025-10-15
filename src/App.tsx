import React, { Suspense } from 'react';
import { Toaster } from 'sonner';
import { SettingsProvider } from './contexts/SettingsContext';
import { AppStateProvider, useAppState } from './contexts/AppStateContext';
import { TooltipProvider } from "@/components/ui/tooltip";
import DashboardSkeleton from './components/DashboardSkeleton';
import { FactCheckAssistant } from './components/FactCheckAssistant';

const TruScopeJournalismPlatform = React.lazy(() => import('./components/TruScopeJournalismPlatform'));

const AppContent: React.FC = () => {
  const { currentReport, isAssistantOpen, closeAssistant, originalContent } = useAppState();

  return (
    <>
      <TruScopeJournalismPlatform />
      {currentReport && (
        <FactCheckAssistant
          report={currentReport}
          isOpen={isAssistantOpen}
          onClose={closeAssistant}
          originalContent={originalContent || ''}
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
