// src/utils/logger.ts

enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

const log = (level: LogLevel, message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  if (data) {
    console.log(`[${timestamp}] [${level}] ${message}`, data);
  } else {
    console.log(`[${timestamp}] [${level}] ${message}`);
  }
};

export const logger = {
  info: (message: string, data?: any) => log(LogLevel.INFO, message, data),
  warn: (message: string, data?: any) => log(LogLevel.WARN, message, data),
  error: (message: string, error: any) => {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    log(LogLevel.ERROR, `${message}: ${errorMessage}`, {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      fullError: error,
    });
  },
};
