// src/utils/api-client.ts
// Helper function to call the unified API endpoint

export async function callUnifiedAPI(action: string, data: any = {}) {
  try {
    const response = await fetch('/api', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action,
        ...data
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || errorData.details || `API call failed: ${response.status}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error(`API call failed for action "${action}":`, error);
    throw error;
  }
}

// Convenience functions for each action
export const apiClient = {
  factCheck: (text: string, publishingContext: string = 'journalism') =>
    callUnifiedAPI('fact-check', { text, publishingContext }),

  autoCorrect: (text: string, factCheckResult: any, mode: string) =>
    callUnifiedAPI('auto-correct', { text, factCheckResult, mode }),

  serpSearch: (query: string) =>
    callUnifiedAPI('serp-search', { query }),

  webzNewsSearch: (query: string, fromDate?: string) =>
    callUnifiedAPI('webz-news-search', { query, fromDate }),

  generateSchema: (formData: any) =>
    callUnifiedAPI('generate-schema', formData),

  healthCheck: () =>
    callUnifiedAPI('health-check'),

  advancedEditor: (text: string, mode: string, prompt: string) =>
    callUnifiedAPI('advanced-editor', { text, mode, prompt }),

  blobAnalytics: (period: string = '7d', type?: string) =>
    callUnifiedAPI('blob-analytics', { period, type }),

  blobSaveReport: (report: any) =>
    callUnifiedAPI('blob-save-report', report),

  blobDeleteReport: (reportId: string) =>
    callUnifiedAPI('blob-delete-report', { reportId }),

  blobExportBulk: (factCheckIds: string[], format: string = 'json', includeAnalytics: boolean = false) =>
    callUnifiedAPI('blob-export-bulk', { factCheckIds, format, includeAnalytics }),

  blobSaveBatchResults: (id: string, results: any[], originalText: string, factCheckId: string, timestamp: string) =>
    callUnifiedAPI('blob-save-batch-results', { id, results, originalText, factCheckId, timestamp }),

  blobSaveFactDatabase: (facts: any) =>
    callUnifiedAPI('blob-save-fact-database', facts),

  blobLoadEditorHistory: (factCheckId: string, mode?: string) =>
    callUnifiedAPI('blob-load-editor-history', { factCheckId, mode })
};
