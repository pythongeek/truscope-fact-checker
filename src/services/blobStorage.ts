import { put, del, list } from '@vercel/blob';

export interface StoredReport {
  id: string;
  originalText: string;
  report: any;
  corrections: any[];
  timestamp: string;
  userId?: string; // For future user system
}

export class BlobStorageService {
  private readonly BLOB_PREFIX = 'truescope-reports/';

  async saveReport(report: StoredReport): Promise<string> {
    try {
      const filename = `${this.BLOB_PREFIX}${report.id}.json`;
      const blob = await put(filename, JSON.stringify(report), {
        access: 'public', // Change to 'private' in production
        addRandomSuffix: false,
      });

      return blob.url;
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
      const filename = `${this.BLOB_PREFIX}${reportId}.json`;
      await del(filename);
      return true;
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
}
