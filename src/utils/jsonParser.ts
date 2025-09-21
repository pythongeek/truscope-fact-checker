// utils/jsonParser.ts

/**
 * Safely parses JSON from AI model responses that might be wrapped in markdown code blocks
 * or contain other formatting artifacts.
 */
export function parseAIResponse(responseText: string): any {
  if (!responseText || typeof responseText !== 'string') {
    throw new Error('Invalid response: empty or non-string input');
  }

  // Use a more reliable method to find the JSON content using regex
  // This looks for content starting with `{` and ending with `}`
  const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/i);

  let cleanedResponse;

  if (jsonMatch && jsonMatch[1]) {
    // If a markdown code block is found, use its content
    cleanedResponse = jsonMatch[1];
  } else {
    // If no markdown block is found, try to find a standalone JSON object
    const standaloneJsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (standaloneJsonMatch && standaloneJsonMatch[0]) {
      cleanedResponse = standaloneJsonMatch[0];
    } else {
      // If no JSON object is found, try to clean the raw response
      cleanedResponse = responseText
        .replace(/^Here's the.*?:\s*/i, '')
        .replace(/^Response:\s*/i, '')
        .replace(/^JSON:\s*/i, '')
        .trim();
    }
  }

  try {
    return JSON.parse(cleanedResponse);
  } catch (parseError) {
    console.error('JSON parsing failed. Original response:', responseText);
    console.error('Cleaned response:', cleanedResponse);
    console.error('Parse error:', parseError);

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
