const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 1000;

/**
 * A wrapper around the standard `fetch` API that provides automatic retries
 * with exponential backoff for server-side errors (5xx status codes) and network failures.
 *
 * @param {string} url - The URL to fetch.
 * @param {RequestInit} [options] - The options for the fetch request, same as the standard `fetch` API.
 * @returns {Promise<Response>} A promise that resolves to the Response object if the request is successful.
 * @throws {Error} Throws the last error encountered after all retry attempts have been exhausted.
 */
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

  // This line is only reached if all retries fail.
  // The 'lastError' will be non-null here, so we can safely cast it.
  throw lastError as Error;
};
