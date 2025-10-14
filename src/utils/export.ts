import { FactCheckReport, EvidenceItem } from '@/types';

/**
 * Generates a standardized filename for exports.
 * @param verdict - The final verdict of the report.
 * @param extension - The file extension (e.g., 'json', 'csv').
 * @returns A formatted filename string.
 */
const generateFilename = (verdict: string, extension: string): string => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeVerdict = verdict.replace(/\s+/g, '-').toLowerCase();
    return `truescope-report-${safeVerdict}-${timestamp}.${extension}`;
};

/**
 * Triggers a browser download for the given data.
 * @param data - The string data to be downloaded.
 * @param filename - The name of the file to be saved.
 * @param mimeType - The MIME type of the file.
 */
const triggerDownload = (data: string, filename: string, mimeType: string): void => {
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

/**
 * Creates a summary object from a full FactCheckReport.
 * @param report - The full analysis report.
 * @returns A simplified summary object.
 */
const createReportSummary = (report: FactCheckReport) => {
    // FIXED: Use camelCase properties and handle possibly undefined values
    return {
        finalVerdict: report.finalVerdict || 'UNVERIFIED',
        finalScore: report.finalScore || 0,
        method: report.metadata?.methodUsed || 'unknown',
        processingTimeMs: report.metadata?.processingTimeMs || 0,
        evidenceCount: report.evidence?.length || 0,
        sourcesConsulted: report.metadata?.sourcesConsulted?.total || 0,
        warnings: report.metadata?.warnings || [],
    };
};

/**
 * Converts an array of EvidenceItem objects to a CSV string.
 * Handles escaping of special characters.
 * @param evidence - The array of evidence items.
 * @returns A CSV formatted string.
 */
const convertEvidenceToCsv = (evidence: EvidenceItem[]): string => {
    if (evidence.length === 0) {
        return 'id,publisher,url,quote,score,type,title,snippet,publishedDate\n';
    }

    // FIXED: Include more detailed fields
    const headers = ['id', 'publisher', 'url', 'quote', 'score', 'type', 'title', 'snippet', 'publishedDate'];
    
    // Helper to escape CSV fields
    const escapeCsvField = (field: any): string => {
        const str = String(field ?? '');
        if (/[",\n]/.test(str)) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    const headerRow = headers.join(',');
    const dataRows = evidence.map(item => {
        return [
            escapeCsvField(item.id),
            escapeCsvField(item.publisher),
            escapeCsvField(item.url || ''),
            escapeCsvField(item.quote || ''),
            escapeCsvField(item.score),
            escapeCsvField(item.type),
            escapeCsvField(item.title || ''),
            escapeCsvField(item.snippet || ''),
            escapeCsvField(item.publishedDate || '')
        ].join(',');
    });

    return [headerRow, ...dataRows].join('\n');
};

export type ExportFormat = 'json-full' | 'json-summary' | 'csv-evidence';

/**
 * Handles the export logic based on the selected format.
 * @param report - The FactCheckReport to export.
 * @param format - The desired export format.
 */
export const handleExport = (report: FactCheckReport, format: ExportFormat): void => {
    // FIXED: Use camelCase property names consistently
    const verdict = report.finalVerdict || 'UNVERIFIED';
    
    switch (format) {
        case 'json-full': {
            const filename = generateFilename(verdict, 'json');
            const jsonData = JSON.stringify(report, null, 2);
            triggerDownload(jsonData, filename, 'application/json');
            break;
        }
        case 'json-summary': {
            const filename = generateFilename(verdict, 'json');
            const summary = createReportSummary(report);
            const jsonData = JSON.stringify(summary, null, 2);
            triggerDownload(jsonData, filename, 'application/json');
            break;
        }
        case 'csv-evidence': {
            const filename = generateFilename(verdict, 'csv');
            const csvData = convertEvidenceToCsv(report.evidence || []);
            triggerDownload(csvData, filename, 'text/csv;charset=utf-8;');
            break;
        }
        default:
            console.error(`Unsupported export format: ${format}`);
    }
};
