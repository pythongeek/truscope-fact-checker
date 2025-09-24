// src/services/historyService.ts

import { HistoryEntry, FactCheckResult, AnalysisMode } from '../types';

const STORAGE_KEY = 'truescope_history';

export class HistoryService {
  static saveReportToHistory(
    originalText: string,
    result: FactCheckResult,
    mode: AnalysisMode = 'comprehensive',
    processingTime: number = 0
  ): void {
    try {
      const history = this.getHistory();
      const entry: HistoryEntry = {
        id: `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        originalText,
        result,
        mode,
        processingTime
      };

      // Add to beginning of array
      history.unshift(entry);

      // Keep only last 50 entries
      const trimmedHistory = history.slice(0, 50);

      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedHistory));
    } catch (error) {
      console.error('Failed to save to history:', error);
    }
  }

  static getHistory(): HistoryEntry[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];

      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('Failed to load history:', error);
      return [];
    }
  }

  static clearHistory(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear history:', error);
    }
  }

  static deleteEntry(id: string): void {
    try {
      const history = this.getHistory();
      const filtered = history.filter(entry => entry.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Failed to delete entry:', error);
    }
  }

  static getEntry(id: string): HistoryEntry | null {
    try {
      const history = this.getHistory();
      return history.find(entry => entry.id === id) || null;
    } catch (error) {
      console.error('Failed to get entry:', error);
      return null;
    }
  }
}

// Named exports for compatibility
export const saveReportToHistory = HistoryService.saveReportToHistory;
export const getHistory = HistoryService.getHistory;
export const clearHistory = HistoryService.clearHistory;
export const deleteEntry = HistoryService.deleteEntry;
export const getEntry = HistoryService.getEntry;