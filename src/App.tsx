// src/App.tsx
import React, { Suspense } from 'react';
import { Toaster } from 'sonner';
import { SettingsProvider } from './contexts/SettingsContext';
import { AppStateProvider } from './contexts/AppStateContext';
import { TooltipProvider } from "@/components/ui/tooltip";
import DashboardSkeleton from './components/DashboardSkeleton';

const TruScopeJournalismPlatform = React.lazy(() => import('./components/TruScopeJournalismPlatform'));

function App() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <SettingsProvider>
        <AppStateProvider>
          <TooltipProvider>
            <TruScopeJournalismPlatform />
            <Toaster />
          </TooltipProvider>
        </AppStateProvider>
      </SettingsProvider>
    </Suspense>
  );
}

export default App;
