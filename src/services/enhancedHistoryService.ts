// src/services/enhancedHistoryService.ts

import { HistoryEntry, FactCheckResult, AnalysisMode } from '../types';

export class EnhancedHistoryService {
  private static readonly STORAGE_KEY = 'truescope_enhanced_history';
  private static readonly MAX_ENTRIES = 100;
  private static readonly BLOB_STORAGE_PREFIX = 'history-entries';

  static async saveEntry(
    originalText: string,
    result: FactCheckResult,
    mode: AnalysisMode,
    processingTime: number
  ): Promise<string> {
    const entry: HistoryEntry = {
      id: `enhanced_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      originalText,
      result,
      mode,
      processingTime
    };

    // Save to localStorage for quick access
    await this.saveToLocalStorage(entry);

    // Optionally save to blob storage for persistence
    try {
      await this.saveToBlobStorage(entry);
    } catch (error) {
      console.warn('Failed to save to blob storage:', error);
    }

    return entry.id;
  }

  private static async saveToLocalStorage(entry: HistoryEntry): Promise<void> {
    try {
      const history = this.getLocalHistory();
      history.unshift(entry);

      // Trim to max entries
      const trimmed = history.slice(0, this.MAX_ENTRIES);

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(trimmed));
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
    }
  }

  private static async saveToBlobStorage(entry: HistoryEntry): Promise<void> {
    const response = await fetch('/api/blob/save-history-entry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    });

    if (!response.ok) {
      throw new Error(`Failed to save to blob storage: ${response.statusText}`);
    }
  }

  static getLocalHistory(): HistoryEntry[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return [];

      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('Failed to load local history:', error);
      return [];
    }
  }

  static async getFullHistory(): Promise<HistoryEntry[]> {
    // Start with local history
    const localHistory = this.getLocalHistory();

    // Try to merge with blob storage if available
    try {
      const response = await fetch('/api/blob/get-history');
      if (response.ok) {
        const blobHistory = await response.json();
        // Merge and deduplicate
        const merged = this.mergeHistories(localHistory, blobHistory);
        return merged;
      }
    } catch (error) {
      console.warn('Could not fetch blob history:', error);
    }

    return localHistory;
  }

  private static mergeHistories(local: HistoryEntry[], blob: HistoryEntry[]): HistoryEntry[] {
    const seen = new Set();
    const merged: HistoryEntry[] = [];

    [...local, ...blob].forEach(entry => {
      if (!seen.has(entry.id)) {
        seen.add(entry.id);
        merged.push(entry);
      }
    });

    return merged.sort((a, b) => b.timestamp - a.timestamp);
  }

  static clearAllHistory(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }
}