// api/index.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import advancedEditorHandler from '../src/api-lib/advanced-editor';
import autoCorrectHandler from '../src/api-lib/auto-correct';
import factCheckHandler from '../src/api-lib/fact-check';
import generateSchemaHandler from '../src/api-lib/generate-schema';
import healthCheckHandler from '../src/api-lib/health-check';
import serpSearchHandler from '../src/api-lib/serp-search';
import webzNewsSearchHandler from '../src/api-lib/webz-news-search';
import blobAnalyticsHandler from '../src/api-lib/blob-analytics';
import blobDeleteReportHandler from '../src/api-lib/blob-delete-report';
import blobExportBulkHandler from '../src/api-lib/blob-export-bulk';
import blobLoadEditorHistoryHandler from '../src/api-lib/blob-load-editor-history';
import blobSaveBatchResultsHandler from '../src/api-lib/blob-save-batch-results';
import blobSaveFactDatabaseHandler from '../src/api-lib/blob-save-fact-database';
import blobSaveReportHandler from '../src/api-lib/blob-save-report';

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void> | void;

const handlers: { [key: string]: Handler } = {
  'advanced-editor': advancedEditorHandler,
  'auto-correct': autoCorrectHandler,
  'fact-check': factCheckHandler,
  'generate-schema': generateSchemaHandler,
  'health-check': healthCheckHandler,
  'serp-search': serpSearchHandler,
  'webz-news-search': webzNewsSearchHandler,
  'blob-analytics': blobAnalyticsHandler,
  'blob-delete-report': blobDeleteReportHandler,
  'blob-export-bulk': blobExportBulkHandler,
  'blob-load-editor-history': blobLoadEditorHistoryHandler,
  'blob-save-batch-results': blobSaveBatchResultsHandler,
  'blob-save-fact-database': blobSaveFactDatabaseHandler,
  'blob-save-report': blobSaveReportHandler,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { action } = req.body;

  if (typeof action !== 'string' || !handlers[action]) {
    return res.status(400).json({ error: 'Invalid or missing action' });
  }

  const { action: _, ...bodyWithoutAction } = req.body;
  req.body = bodyWithoutAction;

  await handlers[action](req, res);
}
