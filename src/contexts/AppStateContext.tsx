// src/contexts/AppStateContext.tsx
import React, { createContext, useState, useContext } from 'react';

type View = 'checker' | 'history' | 'trending';

interface AppStateContextType {
  currentView: View;
  setCurrentView: (view: View) => void;
}

const AppStateContext = createContext<AppStateContextType | undefined>(undefined);

export const AppStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentView, setCurrentView] = useState<View>('checker');

  return (
    <AppStateContext.Provider value={{ currentView, setCurrentView }}>
      {children}
    </AppStateContext.Provider>
  );
};

export const useAppState = () => {
  const context = useContext(AppStateContext);
  if (context === undefined) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
};
