// Add comprehensive logging
export class Logger {
  static logBlobOperation(operation: string, data: any) {
    console.log(`[BLOB] ${operation}:`, {
      timestamp: new Date().toISOString(),
      operation,
      dataSize: JSON.stringify(data).length,
      hasToken: !!process.env.BLOB_READ_WRITE_TOKEN
    });
  }

  static logError(context: string, error: any) {
    console.error(`[ERROR] ${context}:`, {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
}