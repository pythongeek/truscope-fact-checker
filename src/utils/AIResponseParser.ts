// Enhanced JSON parser for AI responses
export class AIResponseParser {
  static parseAIResponse(responseText: string): any {
    try {
      // First attempt: standard JSON parse
      return JSON.parse(responseText);
    } catch (error) {
      console.warn('[JSON Fix] Standard parse failed, attempting cleanup');

      try {
        // Clean common AI response issues
        let cleaned = responseText
          .replace(/```json\s*/g, '')  // Remove markdown code blocks
          .replace(/```\s*/g, '')
          .replace(/^\s*\{/, '{')       // Ensure starts with {
          .replace(/\}\s*$/, '}')       // Ensure ends with }
          .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
          .replace(/([{,]\s*)(\w+):/g, '$1"$2":'); // Quote unquoted keys

        return JSON.parse(cleaned);
      } catch (secondError) {
        console.error('[JSON Fix] All parsing attempts failed');
        throw new Error(`Failed to parse AI response: ${secondError.message}`);
      }
    }
  }
}