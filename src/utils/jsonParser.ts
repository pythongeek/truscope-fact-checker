// utils/jsonParser.ts

/**
 * Safely parses JSON from AI model responses that might be wrapped in markdown code blocks
 * or contain other formatting artifacts.
 */
export function parseAIResponse(responseText: string): any {
  if (!responseText || typeof responseText !== 'string') {
    throw new Error('Invalid response: empty or non-string input');
  }

  // Remove leading/trailing whitespace
  let cleanedResponse = responseText.trim();

  // Remove markdown code block formatting if present
  if (cleanedResponse.startsWith('```json') || cleanedResponse.startsWith('```')) {
    // Find the opening code block
    const firstBlockStart = cleanedResponse.indexOf('```');
    const firstLineEnd = cleanedResponse.indexOf('\n', firstBlockStart);

    // Find the closing code block
    const lastBlockStart = cleanedResponse.lastIndexOf('```');

    if (firstBlockStart !== -1 && lastBlockStart !== -1 && firstBlockStart !== lastBlockStart) {
      // Extract content between code blocks
      cleanedResponse = cleanedResponse.substring(firstLineEnd + 1, lastBlockStart).trim();
    } else if (firstBlockStart !== -1) {
      // Handle single code block marker
      cleanedResponse = cleanedResponse.substring(firstLineEnd + 1).trim();
    }
  }

  // Remove any remaining markdown artifacts
  cleanedResponse = cleanedResponse
    .replace(/^```json\s*/i, '')  // Remove opening json code block
    .replace(/^```\s*/i, '')      // Remove opening code block
    .replace(/```\s*$/i, '')      // Remove closing code block
    .trim();

  // Additional cleaning for common AI response artifacts
  cleanedResponse = cleanedResponse
    .replace(/^Here's the.*?:\s*/i, '')  // Remove "Here's the response:" type prefixes
    .replace(/^Response:\s*/i, '')       // Remove "Response:" prefix
    .replace(/^JSON:\s*/i, '')           // Remove "JSON:" prefix
    .trim();

  try {
    return JSON.parse(cleanedResponse);
  } catch (initialError) {
    // If parsing fails, try to extract JSON from within the text
    const jsonMatches = cleanedResponse.match(/\{[\s\S]*\}/);
    if (jsonMatches && jsonMatches[0]) {
      try {
        return JSON.parse(jsonMatches[0]);
      } catch (secondaryError) {
        console.error('JSON parsing failed. Original response:', responseText);
        console.error('Cleaned response:', cleanedResponse);
        console.error('Initial error:', initialError);
        console.error('Secondary error:', secondaryError);

        throw new Error('The AI model returned an invalid JSON structure. This may be a temporary issue.');
      }
    }

    // If all else fails, throw the original error with context
    console.error('JSON parsing failed. Original response:', responseText);
    console.error('Cleaned response:', cleanedResponse);
    console.error('Parse error:', initialError);

    throw new Error('The AI model returned an invalid JSON structure. This may be a temporary issue.');
  }
}

/**
 * Validates that a parsed object has the expected structure for a fact-check response
 */
export function validateFactCheckResponse(data: any): boolean {
  if (!data || typeof data !== 'object') {
    return false;
  }

  // Check for required fields in fact-check response
  const requiredFields = ['final_verdict', 'final_score', 'score_breakdown', 'evidence'];

  for (const field of requiredFields) {
    if (!(field in data)) {
      console.warn(`Missing required field: ${field}`);
      return false;
    }
  }

  // Validate score is a number between 0 and 100
  if (typeof data.final_score !== 'number' || data.final_score < 0 || data.final_score > 100) {
    console.warn('Invalid final_score:', data.final_score);
    return false;
  }

  // Validate evidence is an array
  if (!Array.isArray(data.evidence)) {
    console.warn('Evidence is not an array:', data.evidence);
    return false;
  }

  return true;
}

/**
 * Safe wrapper for parsing and validating AI responses
 */
export function parseAndValidateFactCheckResponse(responseText: string): any {
  const parsed = parseAIResponse(responseText);

  if (!validateFactCheckResponse(parsed)) {
    throw new Error('The AI response does not contain the expected fact-check structure.');
  }

  return parsed;
}
