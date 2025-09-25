import { list } from '@vercel/blob';

export interface StoredReport {
  id: string;
  originalText: string;
  report: any;
  corrections: any[];
  timestamp: string;
  userId?: string; // For future user system
}

import { FactDatabase } from '../types/factDatabase';

export class BlobStorageService {
  private static instance: BlobStorageService;
  private readonly BLOB_PREFIX = 'truescope-reports/';
  private readonly FACT_DB_PATH = 'fact-database/db.json';

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
          console.log('Fact database not found, starting with an empty one.');
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
}
