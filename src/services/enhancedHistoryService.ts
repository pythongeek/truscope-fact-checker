import { v4 as uuidv4 } from 'uuid';
import { HistoryEntry, FactCheckResult, AnalysisMode } from '../types';
import { AIResponseParser } from '../utils/AIResponseParser';

const ENHANCED_HISTORY_KEY = 'enhancedFactCheckHistory_v2';
const MAX_HISTORY_ITEMS = 100;

export interface PaginatedHistory {
  entries: HistoryEntry[];
  hasMore: boolean;
  currentPage: number;
}

class EnhancedHistoryService {
  private historyCache: HistoryEntry[] | null = null;

  private loadHistory(): HistoryEntry[] {
    if (this.historyCache) {
      return this.historyCache;
    }
    try {
      const stored = localStorage.getItem(ENHANCED_HISTORY_KEY);
      this.historyCache = stored ? AIResponseParser.parseAIResponse(stored) : [];
      return this.historyCache!;
    } catch (error) {
      console.error("Failed to load or parse history:", error);
      return [];
    }
  }

  private saveHistory(history: HistoryEntry[]): void {
    try {
      this.historyCache = history;
      localStorage.setItem(ENHANCED_HISTORY_KEY, JSON.stringify(history));
    } catch (error) {
      console.error("Failed to save history:", error);
    }
  }

  addEntry(
    text: string,
    mode: AnalysisMode,
    result: FactCheckResult
  ): HistoryEntry {
    const newEntry: HistoryEntry = {
      id: uuidv4(),
      date: new Date().toISOString(),
      text: text,
      mode,
      result,
      version: '2.0'
    };
    const history = this.loadHistory();
    const updatedHistory = [newEntry, ...history].slice(0, MAX_HISTORY_ITEMS);
    this.saveHistory(updatedHistory);
    return newEntry;
  }

  getHistory(page: number = 1, limit: number = 10): PaginatedHistory {
    const history = this.loadHistory();
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const entries = history.slice(startIndex, endIndex);

    return {
      entries,
      hasMore: endIndex < history.length,
      currentPage: page,
    };
  }

  getEntry(id: string): HistoryEntry | undefined {
    const history = this.loadHistory();
    return history.find(entry => entry.id === id);
  }

  updateEntry(id: string, updatedData: Partial<HistoryEntry>): HistoryEntry | undefined {
    let history = this.loadHistory();
    const entryIndex = history.findIndex(entry => entry.id === id);
    if (entryIndex > -1) {
      history[entryIndex] = { ...history[entryIndex], ...updatedData, date: new Date().toISOString() };
      this.saveHistory(history);
      return history[entryIndex];
    }
    return undefined;
  }

  deleteEntry(id: string): boolean {
    let history = this.loadHistory();
    const newHistory = history.filter(entry => entry.id !== id);
    if (newHistory.length < history.length) {
      this.saveHistory(newHistory);
      return true;
    }
    return false;
  }

  clearHistory(): void {
    this.saveHistory([]);
  }

  searchHistory(query: string): HistoryEntry[] {
    const history = this.loadHistory();
    const lowercasedQuery = query.toLowerCase();
    return history.filter(entry =>
      entry.text.toLowerCase().includes(lowercasedQuery) ||
      entry.result.summary.overall_rating.toLowerCase().includes(lowercasedQuery) ||
      entry.result.claims.some(claim => claim.claim.toLowerCase().includes(lowercasedQuery))
    );
  }
}

export const enhancedHistoryService = new EnhancedHistoryService();