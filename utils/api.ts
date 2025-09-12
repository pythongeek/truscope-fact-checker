const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 1000;

export const fetchWithRetry = async (url: string, options?: RequestInit): Promise<Response> => {
  let lastError: Error | null = null;

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const response = await fetch(url, options);

      // Retry on 5xx server errors
      if (response.status >= 500 && response.status < 600) {
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('An unknown error occurred');

      // If this was the last attempt, re-throw the error
      if (i === MAX_RETRIES - 1) {
        break;
      }

      // Exponential backoff
      const delay = INITIAL_DELAY_MS * Math.pow(2, i);
      console.log(`Request failed. Retrying in ${delay}ms... (Attempt ${i + 1}/${MAX_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
};
