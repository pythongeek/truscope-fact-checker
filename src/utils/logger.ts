// src/utils/logger.ts

const isVercel = process.env.VERCEL === '1';
const isProduction = process.env.NODE_ENV === 'production';

interface LogData {
  message: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  data?: Record<string, any>;
}

function logToConsole(logData: LogData) {
  const timestamp = new Date().toISOString();
  const logString = `${timestamp} [${logData.level}] ${logData.message}`;

  if (logData.data) {
    console.log(logString, logData.data);
  } else {
    console.log(logString);
  }

  if (logData.level === 'ERROR' && logData.data?.error instanceof Error) {
    console.error(logData.data.error.stack);
  }
}

export const logger = {
  info: (message: string, data?: Record<string, any>) => {
    if (!isProduction || isVercel) {
      logToConsole({ message, level: 'INFO', data });
    }
  },
  warn: (message: string, data?: Record<string, any>) => {
    if (!isProduction || isVercel) {
      logToConsole({ message, level: 'WARN', data });
    }
  },
  error: (message: string, error: any, data?: Record<string, any>) => {
    logToConsole({ message, level: 'ERROR', data: { ...data, error } });
  },
};
