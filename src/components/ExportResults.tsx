import React from 'react';
import { FactCheckReport } from '@/types';
import { ExportIcon } from './icons';

// --- Utility Functions ---

/**
 * Generates a standardized filename for batch exports.
 * @param count - The number of items in the batch.
 * @param type - A string representing the export type (e.g., 'json', 'csv').
 * @param extension - The file extension.
 * @returns A formatted filename string.
 */
const generateFilename = (count: number, type: string, extension: string): string => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `truscope-report-batch-${count}-items-${type}-${timestamp}.${extension}`;
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


// --- Export Logic ---

/**
 * Converts the results array to a JSON string and triggers a download.
 * @param results - An array of FactCheckReport objects.
 */
const exportToJSON = (results: FactCheckReport[]): void => {
    if (!results || results.length === 0) return;
    const filename = generateFilename(results.length, 'full', 'json');
    const jsonData = JSON.stringify(results, null, 2);
    triggerDownload(jsonData, filename, 'application/json');
};

/**
 * Maps the results to a CSV format and triggers a download.
 * @param results - An array of FactCheckReport objects.
 */
const exportToCSV = (results: FactCheckReport[]): void => {
    if (!results || results.length === 0) return;

    const escapeCsvField = (field: any): string => {
        const str = String(field ?? ''); // Use nullish coalescing for safety
        if (/[",\n]/.test(str)) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };
    
    // As the original claim is not in the report, we summarize the report's findings.
    const headers = [
        'overall_authenticity_score', 'verdict', 'method_used',
        'processing_time_ms', 'total_sources', 'high_credibility_sources', 'conflicting_sources',
        'evidence_count', 'warnings'
    ];
    
    const headerRow = headers.join(',');

    const dataRows = results.map(report => {
        // FIX: Safely access nested properties using optional chaining (?.) and nullish coalescing (??)
        const sources = report.metadata?.sources_consulted;
        const row = [
            escapeCsvField(report.overallAuthenticityScore),
            escapeCsvField(report.claimVerifications?.[0]?.status ?? 'N/A'),
            escapeCsvField(report.metadata?.method_used),
            escapeCsvField(report.metadata?.processing_time_ms),
            escapeCsvField(sources?.total ?? 0),
            escapeCsvField(sources?.high_credibility ?? 0),
            escapeCsvField(sources?.conflicting ?? 0),
            escapeCsvField(report.evidence?.length ?? 0),
            escapeCsvField(report.metadata?.warnings?.join('; ') ?? ''),
        ];
        return row.join(',');
    });
    
    const csvData = [headerRow, ...dataRows].join('\n');
    const filename = generateFilename(results.length, 'summary', 'csv');
    triggerDownload(csvData, filename, 'text/csv;charset=utf-8;');
};


/**
 * Creates a human-readable Markdown report and triggers a download.
 * @param results - An array of FactCheckReport objects.
 */
const generateReport = (results: FactCheckReport[]): void => {
    if (!results || results.length === 0) return;

    let markdownContent = `# TruScope AI Batch Analysis Report\n\n`;
    markdownContent += `**Date:** ${new Date().toLocaleString()}\n`;
    markdownContent += `**Total Reports:** ${results.length}\n\n---\n\n`;

    results.forEach((report, index) => {
        // FIX: Safely access nested properties to avoid runtime errors.
        const sources = report.metadata?.sources_consulted;
        markdownContent += `## Report ${index + 1}: Verdict "${report.claimVerifications?.[0]?.status ?? 'N/A'}" (Score: ${report.overallAuthenticityScore ?? 'N/A'}/100)\n\n`;
        markdownContent += `*This is a summary of an automated analysis. The original claim text is not included in this export format.*\n\n`;
        
        markdownContent += `### Analysis Details\n`;
        markdownContent += `- **Method:** ${report.metadata?.method_used ?? 'Unknown'}\n`;
        markdownContent += `- **Processing Time:** ${report.metadata?.processing_time_ms ?? 'N/A'} ms\n`;
        markdownContent += `- **Sources Consulted:** ${sources?.total ?? 0} (High Credibility: ${sources?.high_credibility ?? 0}, Conflicting: ${sources?.conflicting ?? 0})\n\n`;
        
        if (report.metadata?.warnings && report.metadata.warnings.length > 0) {
            markdownContent += `### Warnings\n`;
            report.metadata.warnings.forEach(w => {
                markdownContent += `- ${w}\n`;
            });
            markdownContent += `\n`;
        }

        markdownContent += `### Top 5 Evidence Items\n`;
        if (report.evidence && report.evidence.length > 0) {
            markdownContent += `| Publisher | Reliability Score | Quote Snippet |\n`;
            markdownContent += `|:---|:---:|:---|\n`;
            report.evidence.slice(0, 5).forEach(e => {
                // FIX: Safely handle potentially undefined quote property.
                const quote = (e.quote ?? '').replace(/\n/g, ' ').trim().slice(0, 100);
                markdownContent += `| ${e.publisher ?? 'N/A'} | ${e.score ?? 'N/A'} | ${quote}${(e.quote?.length ?? 0) > 100 ? '...' : ''} |\n`;
            });
        } else {
            markdownContent += `No evidence was cited in this report.\n`;
        }
        markdownContent += `\n---\n\n`;
    });

    const filename = generateFilename(results.length, 'report', 'md');
    triggerDownload(markdownContent, filename, 'text/markdown;charset=utf-8;');
};


// --- Component ---

interface ExportResultsProps {
    results: FactCheckReport[];
}

const ExportResults: React.FC<ExportResultsProps> = ({ results }) => {
    if (!results || results.length === 0) {
        return null;
    }

    return (
        <div className="bg-slate-800/50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-slate-100 mb-3">Export All History</h3>
            <div className="flex flex-col sm:flex-row gap-3">
                 <button
                   onClick={() => exportToJSON(results)}
                   className="flex-1 flex items-center justify-center gap-2 px-4 py-2 font-semibold text-slate-300 bg-slate-700/50 rounded-lg hover:bg-slate-600/50 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-indigo-500"
                >
                    <ExportIcon className="w-5 h-5" />
                    <span>Export as JSON</span>
                </button>
                <button
                    onClick={() => exportToCSV(results)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 font-semibold text-slate-300 bg-slate-700/50 rounded-lg hover:bg-slate-600/50 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-indigo-500"
                >
                     <ExportIcon className="w-5 h-5" />
                    <span>Export as CSV</span>
                </button>
                <button
                    onClick={() => generateReport(results)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 font-semibold text-slate-300 bg-slate-700/50 rounded-lg hover:bg-slate-600/50 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-indigo-500"
                >
                     <ExportIcon className="w-5 h-5" />
                    <span>Generate Report (MD)</span>
                </button>
            </div>
        </div>
    );
};

export default ExportResults;
