// src/utils/jsonParser.ts

/**
 * Robustly parses JSON from AI model responses that may contain markdown formatting
 * Handles cases where JSON is wrapped in ```json code blocks or has extra whitespace
 */
export function parseAIJsonResponse(response: string): any {
  if (!response || typeof response !== 'string') {
    throw new Error('Invalid response: Expected a non-empty string');
  }

  // Step 1: Clean the response
  let cleanedResponse = response.trim();

  // Step 2: Remove markdown code block wrappers if present
  // Match ```json, ```, or ``` at the start and ``` at the end
  const codeBlockPattern = /^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/;
  const codeBlockMatch = cleanedResponse.match(codeBlockPattern);

  if (codeBlockMatch) {
    cleanedResponse = codeBlockMatch[1].trim();
  }

  // Step 3: Remove any remaining backticks at the start or end
  cleanedResponse = cleanedResponse.replace(/^`+|`+$/g, '');

  // Step 4: Try to find JSON content if there's extra text
  // Look for content between { and } (for objects) or [ and ] (for arrays)
  if (!cleanedResponse.startsWith('{') && !cleanedResponse.startsWith('[')) {
    // Try to extract JSON from within the text
    const jsonObjectMatch = cleanedResponse.match(/(\{[\s\S]*\})/);
    const jsonArrayMatch = cleanedResponse.match(/(\[[\s\S]*\])/);

    if (jsonObjectMatch) {
      cleanedResponse = jsonObjectMatch[1];
    } else if (jsonArrayMatch) {
      cleanedResponse = jsonArrayMatch[1];
    }
  }

  // Step 5: Final cleanup
  cleanedResponse = cleanedResponse.trim();

  // Step 6: Validate that we have something that looks like JSON
  if (!cleanedResponse.startsWith('{') && !cleanedResponse.startsWith('[')) {
    throw new Error('No valid JSON structure found in the response');
  }

  // Step 7: Attempt to parse with detailed error handling
  try {
    return JSON.parse(cleanedResponse);
  } catch (parseError) {
    // Enhanced error reporting
    console.error('JSON Parse Error Details:', {
      originalResponse: response.substring(0, 200) + (response.length > 200 ? '...' : ''),
      cleanedResponse: cleanedResponse.substring(0, 200) + (cleanedResponse.length > 200 ? '...' : ''),
      error: parseError
    });

    // Try one more time with additional cleaning for common issues
    try {
      // Remove trailing commas (common AI mistake)
      const fixedCommas = cleanedResponse.replace(/,(\s*[}\]])/g, '$1');
      return JSON.parse(fixedCommas);
    } catch (secondError) {
      const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
      throw new Error(`Failed to parse AI response as JSON. Original error: ${errorMessage}`);
    }
  }
}

/**
 * Safely parses JSON with fallback handling
 * Returns null if parsing fails instead of throwing
 */
export function safeParseAIJsonResponse(response: string): any | null {
  try {
    return parseAIJsonResponse(response);
  } catch (error) {
    console.warn('Failed to parse AI JSON response:', error);
    return null;
  }
}

/**
 * Validates that a parsed object has required properties
 */
export function validateAIResponseStructure(parsedData: any, requiredFields: string[]): boolean {
  if (!parsedData || typeof parsedData !== 'object') {
    return false;
  }

  return requiredFields.every(field => {
    const keys = field.split('.');
    let current = parsedData;

    for (const key of keys) {
      if (current === null || current === undefined || !(key in current)) {
        return false;
      }
      current = current[key];
    }

    return true;
  });
}
