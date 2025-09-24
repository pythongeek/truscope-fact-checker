import { HistoryEntry } from '../types';
import { AIResponseParser } from '../utils/AIResponseParser';

const HISTORY_KEY = 'factCheckHistory';

export const historyService = {
  getHistory: (): HistoryEntry[] => {
    try {
      const storedHistory = localStorage.getItem(HISTORY_KEY);
      if (storedHistory) {
        // Since history is stored by our app, we can trust the format.
        // However, for consistency, we could use the robust parser.
        // Let's stick to the original parser for internally-managed data.
        return JSON.parse(storedHistory) as HistoryEntry[];
      }
    } catch (error) {
      console.error('Error parsing history from localStorage:', error);
      // If parsing fails, return an empty array to prevent app crash
      return [];
    }
    return [];
  },

  saveHistory: (history: HistoryEntry[]): void => {
    try {
      const historyString = JSON.stringify(history);
      localStorage.setItem(HISTORY_KEY, historyString);
    } catch (error) {
      console.error('Error saving history to localStorage:', error);
    }
  },

  addHistoryEntry: (entry: HistoryEntry): HistoryEntry[] => {
    const currentHistory = historyService.getHistory();
    const updatedHistory = [entry, ...currentHistory];
    // Optional: Limit history size
    if (updatedHistory.length > 50) {
      updatedHistory.pop();
    }
    historyService.saveHistory(updatedHistory);
    return updatedHistory;
  },

  clearHistory: (): void => {
    localStorage.removeItem(HISTORY_KEY);
  },
};