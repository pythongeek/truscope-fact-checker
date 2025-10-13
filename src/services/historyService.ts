import { FactCheckReport, HistoryEntry, TieredFactCheckResult } from '@/types';

const HISTORY_STORAGE_KEY = 'truescope_history';
const MAX_HISTORY_ITEMS = 20;

/**
 * Retrieves the analysis history from local storage.
 * @returns {HistoryEntry[]} An array of history entries, sorted by most recent first.
 */
export const getHistory = (): HistoryEntry[] => {
    try {
        const storedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
        if (!storedHistory) {
            return [];
        }
        const history = JSON.parse(storedHistory) as HistoryEntry[];
        // Ensure it's sorted, just in case
        return history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (error) {
        console.error("Failed to parse history from local storage:", error);
        return [];
    }
};

/**
 * Saves a new fact-check report to the history in local storage.
 * @param {string} claimText The original text that was analyzed.
 * @param {FactCheckReport} report The resulting analysis report.
 * @param {TieredFactCheckResult} result The tiered fact-check result object.
 */
export const saveReportToHistory = (claimText: string, report: FactCheckReport, result: TieredFactCheckResult): void => {
    try {
        const currentHistory = getHistory();

        const newEntry: HistoryEntry = {
            id: new Date().toISOString(), // Simple unique ID
            timestamp: new Date().toISOString(),
            claimText,
            report,
            result, // Correctly assigned the result object
            query: claimText,
        };

        // Add the new entry to the front and slice to maintain max length
        const updatedHistory = [newEntry, ...currentHistory].slice(0, MAX_HISTORY_ITEMS);

        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updatedHistory));
    } catch (error) {
        console.error("Failed to save report to history:", error);
    }
};

/**
 * Clears all entries from the analysis history in local storage.
 */
export const clearHistory = (): void => {
    try {
        localStorage.removeItem(HISTORY_STORAGE_KEY);
    } catch (error) {
        console.error("Failed to clear history:", error);
    }
};
