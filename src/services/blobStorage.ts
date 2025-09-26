import { list } from '@vercel/blob';

export interface StoredReport {
  id: string;
  originalText: string;
  report: any;
  corrections: any[];
  timestamp: string;
  userId?: string;
}

// Remove EditorResult interface from here since it's defined in types
import { EditorResult } from '../types/advancedEditor';
import { FactDatabase } from '../types/factDatabase';

export class BlobStorageService {
  private static instance: BlobStorageService;
  private readonly BLOB_PREFIX = 'truescope-reports/';
  private readonly FACT_DB_PATH = 'fact-database/db.json';
  // Remove EDITOR_RESULTS_PREFIX since we're not storing editor results

  static getInstance(): BlobStorageService {
    if (!BlobStorageService.instance) {
      BlobStorageService.instance = new BlobStorageService();
    }
    return BlobStorageService.instance;
  }

  async saveReport(report: StoredReport): Promise<string> {
    try {
      const response = await fetch('/api/blob/save-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
      });

      if (!response.ok) {
        throw new Error('Failed to save report');
      }

      const { url } = await response.json();
      return url;
    } catch (error) {
      console.error('Failed to save report to blob storage:', error);
      throw new Error('Failed to save report');
    }
  }

  // REMOVED: saveEditorResult method - no longer needed
  // Editor results will be handled in-memory only to save blob storage space

  async getReport(reportId: string): Promise<StoredReport | null> {
    try {
      const filename = `${this.BLOB_PREFIX}${reportId}.json`;
      const response = await fetch(`https://blob.vercel-storage.com/${filename}`);

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to retrieve report from blob storage:', error);
      return null;
    }
  }

  // REMOVED: getEditorResult method - no longer needed

  async deleteReport(reportId: string): Promise<boolean> {
    try {
      const response = await fetch('/api/blob/delete-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId }),
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to delete report from blob storage:', error);
      return false;
    }
  }

  async listReports(limit: number = 50): Promise<string[]> {
    try {
      const { blobs } = await list({
        prefix: this.BLOB_PREFIX,
        limit,
      });

      return blobs.map(blob =>
        blob.pathname.replace(this.BLOB_PREFIX, '').replace('.json', '')
      );
    } catch (error) {
      console.error('Failed to list reports from blob storage:', error);
      return [];
    }
  }

  // REMOVED: listEditorResults method - no longer needed

  async saveFactDatabase(facts: FactDatabase[]): Promise<void> {
    try {
      const response = await fetch('/api/blob/save-fact-database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(facts),
      });

      if (!response.ok) {
        throw new Error('Failed to save fact database');
      }
    } catch (error) {
      console.error('Failed to save fact database to blob storage:', error);
      throw new Error('Failed to save fact database');
    }
  }

  async loadFactDatabase(): Promise<FactDatabase[]> {
    try {
      const response = await fetch(`https://blob.vercel-storage.com/${this.FACT_DB_PATH}`);
      if (!response.ok) {
        if (response.status === 404) {
          console.log('Fact database not found, creating a new empty one.');
          await this.saveFactDatabase([]); // Create an empty database
          return [];
        }
        throw new Error(`Failed to fetch fact database: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to load fact database from blob storage:', error);
      return []; // Return empty array on error to allow the app to continue
    }
  }

  // NEW: In-memory editor result handling
  static handleEditorResult(result: EditorResult): void {
    // Store in sessionStorage for the current session only
    // This avoids using blob storage while preserving results during the session
    try {
      const key = `editor-result-${Date.now()}`;
      sessionStorage.setItem(key, JSON.stringify({
        ...result,
        timestamp: new Date().toISOString()
      }));

      // Keep only the last 10 results to avoid storage bloat
      const keys = Object.keys(sessionStorage).filter(k => k.startsWith('editor-result-'));
      if (keys.length > 10) {
        keys.sort().slice(0, keys.length - 10).forEach(k => sessionStorage.removeItem(k));
      }

      console.log('Editor result stored in session:', key);
    } catch (error) {
      console.warn('Failed to store editor result in session storage:', error);
      // This is non-critical, so we just warn and continue
    }
  }

  static getRecentEditorResults(): EditorResult[] {
    try {
      const keys = Object.keys(sessionStorage).filter(k => k.startsWith('editor-result-'));
      return keys
        .map(key => {
          try {
            return JSON.parse(sessionStorage.getItem(key) || '');
          } catch {
            return null;
          }
        })
        .filter(Boolean)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (error) {
      console.warn('Failed to retrieve editor results from session storage:', error);
      return [];
    }
  }
}