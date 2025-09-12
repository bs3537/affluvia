import React, { createContext, useContext, useState, ReactNode } from 'react';

interface MonteCarloResult {
  probabilityOfSuccess: number;
  medianEndingBalance: number;
  scenarios: {
    successful: number;
    failed: number;
    total: number;
  };
}

interface RetirementScoreContextType {
  retirementScore: MonteCarloResult | null;
  setRetirementScore: (score: MonteCarloResult | null) => void;
  lastFetchTime: number | null;
  setLastFetchTime: (time: number | null) => void;
}

const RetirementScoreContext = createContext<RetirementScoreContextType | undefined>(undefined);

export function RetirementScoreProvider({ children }: { children: ReactNode }) {
  const [retirementScore, setRetirementScore] = useState<MonteCarloResult | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<number | null>(null);

  return (
    <RetirementScoreContext.Provider value={{ retirementScore, setRetirementScore, lastFetchTime, setLastFetchTime }}>
      {children}
    </RetirementScoreContext.Provider>
  );
}

export function useRetirementScore() {
  const context = useContext(RetirementScoreContext);
  if (!context) {
    throw new Error('useRetirementScore must be used within a RetirementScoreProvider');
  }
  return context;
}