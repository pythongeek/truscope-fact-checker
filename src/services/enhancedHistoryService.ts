import { BlobStorageService, StoredReport } from './blobStorage';
import { FactCheckReport, HistoryEntry } from '@/types';
import { SmartCorrection } from '@/types/corrections';

export class EnhancedHistoryService {
  private blobStorage: BlobStorageService;
  private readonly LOCAL_STORAGE_KEY = 'truescope_report_history_v2'; // New key for new format
  private readonly MAX_LOCAL_REPORTS = 10;

  constructor() {
    this.blobStorage = new BlobStorageService();
  }

  async saveReportWithCorrections(
    originalText: string,
    report: FactCheckReport,
    corrections: SmartCorrection[]
  ): Promise<string> {
    const reportId = this.generateReportId();

    const storedReport: StoredReport = {
      id: reportId,
      originalText,
      report,
      corrections,
      timestamp: new Date().toISOString(),
    };

    try {
      // Save to Vercel Blob Storage for persistence
      await this.blobStorage.saveReport(storedReport);

      // Also save to localStorage for quick access
      this.saveToLocalStorage(storedReport);

      return reportId;
    } catch (error) {
      console.error('Failed to save report, saving to localStorage only:', error);
      this.saveToLocalStorage(storedReport);
      return reportId;
    }
  }

  async getReportWithCorrections(reportId: string): Promise<StoredReport | null> {
    // Try localStorage first for speed
    const localReport = this.getFromLocalStorage(reportId);
    if (localReport) {
      return localReport;
    }

    // Fallback to blob storage
    try {
      const blobReport = await this.blobStorage.getReport(reportId);
      if (blobReport) {
        // Cache the report locally for future fast access
        this.saveToLocalStorage(blobReport);
        return blobReport;
      }
    } catch (error) {
      console.error('Failed to retrieve report from blob storage:', error);
    }

    return null;
  }

  // This method is for displaying the simple history list, so it can still return HistoryEntry
  getLocalHistoryList(): HistoryEntry[] {
    const reports = this.getLocalReports();
    return reports.map(r => ({
      id: r.id,
      claimText: r.originalText,
      report: r.report,
      timestamp: r.timestamp
    }));
  }

  private getLocalReports(): StoredReport[] {
    try {
      const stored = localStorage.getItem(this.LOCAL_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private saveToLocalStorage(report: StoredReport): void {
    try {
      const existing = this.getLocalReports();
      // Add new report and remove duplicates, then slice to max length
      const updated = [report, ...existing.filter(r => r.id !== report.id)].slice(0, this.MAX_LOCAL_REPORTS);
      localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
    }
  }

  private getFromLocalStorage(reportId: string): StoredReport | null {
    const reports = this.getLocalReports();
    return reports.find(r => r.id === reportId) || null;
  }

  private generateReportId(): string {
    return `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async saveFactCheckRecord(record: TieredFactCheckResult): Promise<void> {
    const filePath = `audit-trails/${record.id}.json`;
    await this.blobStorage.upload(filePath, record);
  }

  async getAuditTrailList(): Promise<string[]> {
    const files = await this.blobStorage.listFiles('audit-trails/');
    return files.map(file => file.replace('audit-trails/', '').replace('.json', ''));
  }

  async getAuditTrailRecord(recordId: string): Promise<TieredFactCheckResult | null> {
    const filePath = `audit-trails/${recordId}.json`;
    return await this.blobStorage.getFile(filePath);
  }
}
