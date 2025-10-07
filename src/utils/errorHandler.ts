// src/utils/errorHandler.ts - Comprehensive error handling
export type ErrorCategory =
  | 'api_key'
  | 'network'
  | 'rate_limit'
  | 'validation'
  | 'synthesis'
  | 'storage'
  | 'unknown';

export interface DetailedError {
  category: ErrorCategory;
  message: string;
  userMessage: string;
  technicalDetails?: string;
  suggestions: string[];
  canRetry: boolean;
}

export class AppError extends Error {
  category: ErrorCategory;
  userMessage: string;
  suggestions: string[];
  canRetry: boolean;

  constructor(error: DetailedError) {
    super(error.message);
    this.name = 'AppError';
    this.category = error.category;
    this.userMessage = error.userMessage;
    this.suggestions = error.suggestions;
    this.canRetry = error.canRetry;
  }
}

export function categorizeError(error: any): DetailedError {
  // Network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return {
      category: 'network',
      message: 'Network request failed',
      userMessage: 'Unable to connect to the service. Please check your internet connection.',
      suggestions: [
        'Check your internet connection',
        'Try refreshing the page',
        'Check if you can access other websites'
      ],
      canRetry: true
    };
  }

  // API key errors
  if (
    error?.message?.toLowerCase().includes('api key') ||
    error?.message?.toLowerCase().includes('unauthorized') ||
    error?.message?.toLowerCase().includes('403')
  ) {
    return {
      category: 'api_key',
      message: 'API key error',
      userMessage: 'There is an issue with your API key configuration.',
      suggestions: [
        'Open Settings and verify your Gemini API key',
        'Make sure the API key starts with "AI"',
        'Generate a new API key at https://aistudio.google.com/',
        'Check if your API key has the necessary permissions'
      ],
      canRetry: false
    };
  }

  // Rate limit errors
  if (
    error?.message?.toLowerCase().includes('rate limit') ||
    error?.message?.toLowerCase().includes('429') ||
    error?.message?.toLowerCase().includes('quota')
  ) {
    return {
      category: 'rate_limit',
      message: 'Rate limit exceeded',
      userMessage: 'You have exceeded the API rate limit.',
      suggestions: [
        'Wait a few minutes before trying again',
        'Consider upgrading your API plan',
        'Reduce the frequency of requests'
      ],
      canRetry: true
    };
  }

  // Synthesis errors
  if (
    error?.message?.toLowerCase().includes('synthesis') ||
    error?.message?.toLowerCase().includes('gemini')
  ) {
    return {
      category: 'synthesis',
      message: 'AI synthesis failed',
      userMessage: 'The AI analysis could not be completed.',
      technicalDetails: error?.message,
      suggestions: [
        'The system will use statistical analysis instead',
        'Check your Gemini API key in Settings',
        'Try selecting a different model (e.g., gemini-1.5-flash-latest)',
        'The claim may contain content that the AI cannot process'
      ],
      canRetry: true
    };
  }

  // Storage errors
  if (
    error?.message?.toLowerCase().includes('storage') ||
    error?.message?.toLowerCase().includes('localstorage')
  ) {
    return {
      category: 'storage',
      message: 'Storage error',
      userMessage: 'Unable to save data to browser storage.',
      suggestions: [
        'Check if cookies and site data are enabled',
        'Clear browser cache and try again',
        'Try using a different browser',
        'Check if you are in private/incognito mode'
      ],
      canRetry: false
    };
  }

  // Validation errors
  if (
    error?.message?.toLowerCase().includes('validation') ||
    error?.message?.toLowerCase().includes('invalid')
  ) {
    return {
      category: 'validation',
      message: 'Validation error',
      userMessage: 'The provided input is invalid.',
      technicalDetails: error?.message,
      suggestions: [
        'Check that all required fields are filled',
        'Ensure the content is not empty',
        'Try with different content'
      ],
      canRetry: false
    };
  }

  // Default unknown error
  return {
    category: 'unknown',
    message: error?.message || 'An unexpected error occurred',
    userMessage: 'Something went wrong. Please try again.',
    technicalDetails: error?.stack || error?.toString(),
    suggestions: [
      'Try refreshing the page',
      'Clear your browser cache',
      'Contact support if the problem persists'
    ],
    canRetry: true
  };
}

export function formatErrorMessage(error: any): string {
  const detailed = categorizeError(error);

  let message = `❌ ${detailed.userMessage}\n\n`;

  if (detailed.suggestions.length > 0) {
    message += '💡 Suggestions:\n';
    detailed.suggestions.forEach((suggestion, i) => {
      message += `${i + 1}. ${suggestion}\n`;
    });
  }

  if (detailed.technicalDetails && process.env.NODE_ENV === 'development') {
    message += `\n🔍 Technical Details:\n${detailed.technicalDetails}`;
  }

  return message;
}

export function handleError(error: any, context?: string): DetailedError {
  const detailed = categorizeError(error);

  // Log to console
  console.error(`[${detailed.category.toUpperCase()}] ${context || 'Error'}:`, error);
  console.error('User message:', detailed.userMessage);
  console.error('Suggestions:', detailed.suggestions);

  // In production, you might want to send to error tracking service
  if (process.env.NODE_ENV === 'production') {
    // Example: sendToErrorTracking(detailed, context);
  }

  return detailed;
}

export function showErrorNotification(error: any, context?: string) {
  const detailed = handleError(error, context);
  const message = formatErrorMessage(detailed);

  // You can replace this with a toast notification library
  alert(message);
}

// Retry utility for transient errors
export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const detailed = categorizeError(error);

      if (!detailed.canRetry) {
        throw new AppError(detailed);
      }

      if (attempt < maxRetries) {
        console.log(`⏳ Retry attempt ${attempt}/${maxRetries} after ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
      }
    }
  }

  const detailed = categorizeError(lastError);
  throw new AppError(detailed);
}

// Async error boundary wrapper
export function withErrorHandling<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  context?: string
) {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      const detailed = handleError(error, context || fn.name);
      throw new AppError(detailed);
    }
  };
}