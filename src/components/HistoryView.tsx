import React, { useState, useEffect } from 'react';
import { getHistory, clearHistory } from '../services/historyService';
import { HistoryEntry, FactCheckReport } from '@/types';
import { CheckCircleIcon, ExclamationCircleIcon, XCircleIcon } from './icons';
import ExportResults from './ExportResults';

interface HistoryViewProps {
    onSelectReport: (report: FactCheckReport, claimText: string) => void;
}

const ScoreBadge: React.FC<{ score: number | undefined; verdict: string | undefined }> = ({ score, verdict }) => {
    // FIX: Default the score to 0 if it's undefined to prevent runtime errors.
    const numericScore = score ?? 0;

    const getVerdictStyle = (s: number) => {
        if (s > 75) return { Icon: CheckCircleIcon, color: 'text-green-400' };
        if (s >= 40) return { Icon: ExclamationCircleIcon, color: 'text-yellow-400' };
        return { Icon: XCircleIcon, color: 'text-red-400' };
    };

    const { Icon, color } = getVerdictStyle(numericScore);

    return (
        <div className={`flex items-center gap-2 font-semibold ${color}`}>
            <Icon className="w-5 h-5" />
            {/* FIX: Provide a fallback for the verdict text. */}
            <span>{verdict || 'N/A'} ({numericScore})</span>
        </div>
    );
};

const HistoryView: React.FC<HistoryViewProps> = ({ onSelectReport }) => {
    const [history, setHistory] = useState<HistoryEntry[]>([]);

    useEffect(() => {
        setHistory(getHistory());
    }, []);

    const handleClearHistory = () => {
        clearHistory();
        setHistory([]);
    };
    
    // FIX: Filter out any history entries where the report might be missing or undefined.
    // This resolves the TS2322 error by ensuring the array only contains valid FactCheckReport objects.
    const reportsToExport: FactCheckReport[] = history
        .map(entry => entry.report)
        .filter((report): report is FactCheckReport => report !== undefined);

    if (history.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center text-center text-slate-400 pt-16">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="mt-4 text-xl font-semibold text-slate-300">No History Found</h3>
                <p className="max-w-sm mt-1">Your past analysis reports will appear here.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <header className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold text-slate-100">Analysis History</h2>
                    <p className="text-slate-300 mt-1">Review your past fact-checking reports.</p>
                </div>
                <button
                    onClick={handleClearHistory}
                    className="px-4 py-2 text-sm font-semibold text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors"
                >
                    Clear History
                </button>
            </header>

            <ExportResults results={reportsToExport} />

            <div className="bg-slate-800/50 p-4 rounded-2xl space-y-3">
                {history.map(entry => {
                    // FIX: Ensure entry.report is not undefined before rendering the component part that uses it.
                    if (!entry.report) return null;

                    return (
                        <div key={entry.id} className="bg-slate-900/50 p-4 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div className="flex-1">
                                <p className="text-xs text-slate-300">{new Date(entry.timestamp).toLocaleString()}</p>
                                <p className="font-medium text-slate-200 mt-1 line-clamp-2">"{entry.claimText}"</p>
                                <div className="mt-2">
                                    {/* FIX: Safely access nested properties on entry.report. */}
                                    <ScoreBadge score={entry.report.overallAuthenticityScore} verdict={entry.report.claimVerifications?.[0]?.status} />
                                </div>
                            </div>
                            <button
                                // FIX: Pass entry.report directly, which is now guaranteed to be defined here.
                                onClick={() => onSelectReport(entry.report!, entry.claimText)}
                                className="px-4 py-2 font-semibold text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors w-full sm:w-auto"
                            >
                                View Report
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default HistoryView;
