// ============================================================================
// ROBUST JSON PARSER FOR AI RESPONSES
// ============================================================================

export class RobustJSONParser {
  /**
   * Attempts to parse AI response with multiple fallback strategies
   */
  static parse<T = any>(response: string): T {
    // Strategy 1: Direct parse
    try {
      return JSON.parse(response);
    } catch (e1) {
      console.warn('[RobustJSONParser] Direct parse failed, trying cleanup...');
    }

    // Strategy 2: Extract JSON from markdown code blocks
    try {
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }
    } catch (e2) {
      console.warn('[RobustJSONParser] Markdown extraction failed...');
    }

    // Strategy 3: Find JSON object boundaries
    try {
      const start = response.indexOf('{');
      const end = response.lastIndexOf('}') + 1;
      if (start !== -1 && end > start) {
        const jsonStr = response.substring(start, end);
        return JSON.parse(jsonStr);
      }
    } catch (e3) {
      console.warn('[RobustJSONParser] Boundary extraction failed...');
    }

    // Strategy 4: Fix common JSON issues
    try {
      let cleaned = response
        // Remove comments
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*/g, '')
        // Fix trailing commas
        .replace(/,(\s*[}\]])/g, '$1')
        // Fix unquoted keys (simple cases)
        .replace(/(\{|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
        // Fix single quotes to double quotes
        .replace(/'/g, '"')
        // Remove trailing commas in arrays/objects
        .replace(/,\s*([\]}])/g, '$1');

      return JSON.parse(cleaned);
    } catch (e4) {
      console.warn('[RobustJSONParser] Cleanup parse failed...');
    }

    // Strategy 5: Line-by-line reconstruction
    try {
      const lines = response.split('\n').filter(line => {
        const trimmed = line.trim();
        return trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('/*');
      });
      const reconstructed = lines.join('\n');
      return JSON.parse(reconstructed);
    } catch (e5) {
      console.error('[RobustJSONParser] All parsing strategies failed');
    }

    throw new Error('Failed to parse AI response after all strategies');
  }

  /**
   * Validates that parsed object has required fields
   */
  static validate<T>(obj: any, requiredFields: string[]): obj is T {
    return requiredFields.every(field => field in obj);
  }
}
