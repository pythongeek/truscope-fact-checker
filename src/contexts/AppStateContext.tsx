import React, { createContext, useState, useContext, useCallback } from 'react';
import { FactCheckReport } from '@/types';

// Define the different views the application can have
type View = 'checker' | 'history' | 'trending';

// Define the shape of our application's global state
interface AppStateContextType {
  // View management state
  currentView: View;
  setCurrentView: (view: View) => void;

  // AI Assistant ("Verity") state and functions
  isAssistantOpen: boolean;
  currentReport: FactCheckReport | null;
  setCurrentReport: (report: FactCheckReport | null) => void;
  openAssistant: () => void;
  closeAssistant: () => void;
}

// Create the context with an undefined default value
const AppStateContext = createContext<AppStateContextType | undefined>(undefined);

/**
 * Provides the global application state to all child components.
 * This now includes state for managing the main view and the AI assistant.
 */
export const AppStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentView, setCurrentView] = useState<View>('checker');
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [currentReport, _setCurrentReport] = useState<FactCheckReport | null>(null);

  // Function to open the assistant's chat window
  const openAssistant = useCallback(() => setIsAssistantOpen(true), []);

  // Function to close the assistant's chat window
  const closeAssistant = useCallback(() => setIsAssistantOpen(false), []);

  /**
   * Sets the current fact-check report and automatically opens the assistant.
   * This is the key function that will make Verity appear after a check is complete.
   */
  const setCurrentReport = useCallback((report: FactCheckReport | null) => {
    _setCurrentReport(report);
    if (report) {
      openAssistant();
    }
  }, [openAssistant]);

  // The value provided to consuming components
  const contextValue: AppStateContextType = {
    currentView,
    setCurrentView,
    isAssistantOpen,
    currentReport,
    setCurrentReport,
    openAssistant,
    closeAssistant,
  };

  return (
    <AppStateContext.Provider value={contextValue}>
      {children}
    </AppStateContext.Provider>
  );
};

/**
 * Custom hook to easily access the application state from any component.
 */
export const useAppState = (): AppStateContextType => {
  const context = useContext(AppStateContext);
  if (context === undefined) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
};
