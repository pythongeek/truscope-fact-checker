// src/utils/ColorMarkingUtility.ts
// Utility for applying color markings to text in the editor

import { ColorMarking } from '../services/analysis/EnhancedIntelligentQuerySynthesizer';

export interface HighlightedSegment {
  text: string;
  color: 'red' | 'yellow' | 'green' | 'blue' | 'gray' | null;
  reason?: string;
  severity?: 'critical' | 'warning' | 'info' | 'verified';
  startIndex: number;
  endIndex: number;
}

export interface ColoredText {
  segments: HighlightedSegment[];
  originalText: string;
  markingCount: number;
}

/**
 * Color Marking Utility for Text Editor Integration
 * Converts AI-generated color markings into editor-friendly format
 */
export class ColorMarkingUtility {
  /**
   * Apply color markings to text and generate segments
   */
  static applyMarkings(
    originalText: string,
    markings: ColorMarking[]
  ): ColoredText {
    // Sort markings by start index
    const sortedMarkings = [...markings].sort((a, b) => a.startIndex - b.startIndex);

    // Handle overlapping markings (priority: red > yellow > green > blue > gray)
    const resolvedMarkings = this.resolveOverlaps(sortedMarkings);

    // Create segments
    const segments: HighlightedSegment[] = [];
    let currentIndex = 0;

    for (const marking of resolvedMarkings) {
      // Add unmarked text before this marking
      if (currentIndex < marking.startIndex) {
        segments.push({
          text: originalText.substring(currentIndex, marking.startIndex),
          color: null,
          startIndex: currentIndex,
          endIndex: marking.startIndex
        });
      }

      // Add marked segment
      segments.push({
        text: marking.text,
        color: marking.color,
        reason: marking.reason,
        severity: marking.severity,
        startIndex: marking.startIndex,
        endIndex: marking.endIndex
      });

      currentIndex = marking.endIndex;
    }

    // Add remaining unmarked text
    if (currentIndex < originalText.length) {
      segments.push({
        text: originalText.substring(currentIndex),
        color: null,
        startIndex: currentIndex,
        endIndex: originalText.length
      });
    }

    return {
      segments,
      originalText,
      markingCount: resolvedMarkings.length
    };
  }

  /**
   * Resolve overlapping markings (higher priority wins)
   */
  private static resolveOverlaps(markings: ColorMarking[]): ColorMarking[] {
    const priorityMap = {
      red: 5,
      yellow: 4,
      green: 3,
      blue: 2,
      gray: 1
    };

    const resolved: ColorMarking[] = [];
    
    for (const marking of markings) {
      let shouldAdd = true;
      let replacedIndex = -1;

      // Check for overlaps with existing markings
      for (let i = 0; i < resolved.length; i++) {
        const existing = resolved[i];
        
        // Check if ranges overlap
        if (
          (marking.startIndex >= existing.startIndex && marking.startIndex < existing.endIndex) ||
          (marking.endIndex > existing.startIndex && marking.endIndex <= existing.endIndex) ||
          (marking.startIndex <= existing.startIndex && marking.endIndex >= existing.endIndex)
        ) {
          // Overlap detected - keep higher priority
          if (priorityMap[marking.color] > priorityMap[existing.color]) {
            replacedIndex = i;
            break;
          } else {
            shouldAdd = false;
            break;
          }
        }
      }

      if (replacedIndex >= 0) {
        resolved[replacedIndex] = marking;
      } else if (shouldAdd) {
        resolved.push(marking);
      }
    }

    return resolved.sort((a, b) => a.startIndex - b.startIndex);
  }

  /**
   * Generate HTML with inline styles for color marking
   */
  static toHTML(coloredText: ColoredText): string {
    const colorStyles = {
      red: 'background-color: #fee2e2; border-bottom: 2px solid #dc2626; color: #991b1b;',
      yellow: 'background-color: #fef3c7; border-bottom: 2px solid #f59e0b; color: #92400e;',
      green: 'background-color: #d1fae5; border-bottom: 2px solid #10b981; color: #065f46;',
      blue: 'background-color: #dbeafe; border-bottom: 2px solid #3b82f6; color: #1e40af;',
      gray: 'background-color: #f3f4f6; border-bottom: 2px solid #6b7280; color: #374151;'
    };

    const segments = coloredText.segments.map(segment => {
      if (!segment.color) {
        return this.escapeHTML(segment.text);
      }

      const style = colorStyles[segment.color];
      const title = segment.reason || '';
      
      return `<mark style="${style}" title="${this.escapeHTML(title)}" data-severity="${segment.severity}">${this.escapeHTML(segment.text)}</mark>`;
    });

    return segments.join('');
  }

  /**
   * Generate React components for color marking
   */
  static toReactComponents(coloredText: ColoredText): Array<{
    key: string;
    text: string;
    color: string | null;
    reason?: string;
    severity?: string;
  }> {
    return coloredText.segments.map((segment, index) => ({
      key: `segment-${index}`,
      text: segment.text,
      color: segment.color,
      reason: segment.reason,
      severity: segment.severity
    }));
  }

  /**
   * Get statistics about markings
   */
  static getStatistics(coloredText: ColoredText): {
    total: number;
    byColor: Record<string, number>;
    bySeverity: Record<string, number>;
    coverage: number; // Percentage of text that is marked
  } {
    const byColor: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    let markedLength = 0;

    coloredText.segments.forEach(segment => {
      if (segment.color) {
        byColor[segment.color] = (byColor[segment.color] || 0) + 1;
        
        if (segment.severity) {
          bySeverity[segment.severity] = (bySeverity[segment.severity] || 0) + 1;
        }
        
        markedLength += segment.text.length;
      }
    });

    const coverage = (markedLength / coloredText.originalText.length) * 100;

    return {
      total: coloredText.markingCount,
      byColor,
      bySeverity,
      coverage: Math.round(coverage * 10) / 10
    };
  }

  /**
   * Export markings as JSON for storage
   */
  static exportMarkings(markings: ColorMarking[]): string {
    return JSON.stringify(markings, null, 2);
  }

  /**
   * Import markings from JSON
   */
  static importMarkings(json: string): ColorMarking[] {
    try {
      const parsed = JSON.parse(json);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('Failed to import markings:', error);
      return [];
    }
  }

  /**
   * Filter markings by severity
   */
  static filterBySeverity(
    markings: ColorMarking[],
    severities: Array<'critical' | 'warning' | 'info' | 'verified'>
  ): ColorMarking[] {
    return markings.filter(m => severities.includes(m.severity));
  }

  /**
   * Get only critical markings (red - false claims)
   */
  static getCriticalMarkings(markings: ColorMarking[]): ColorMarking[] {
    return markings.filter(m => m.color === 'red');
  }

  /**
   * Get verification summary for display
   */
  static getVerificationSummary(markings: ColorMarking[]): {
    verified: number;
    false: number;
    unverified: number;
    info: number;
  } {
    const colorCounts = {
      verified: markings.filter(m => m.color === 'green').length,
      false: markings.filter(m => m.color === 'red').length,
      unverified: markings.filter(m => m.color === 'yellow').length,
      info: markings.filter(m => m.color === 'blue' || m.color === 'gray').length
    };

    return colorCounts;
  }

  /**
   * Convert markings to plain text with annotations
   */
  static toPlainTextWithAnnotations(coloredText: ColoredText): string {
    let result = '';
    const annotations: string[] = [];

    coloredText.segments.forEach((segment, index) => {
      if (segment.color) {
        const marker = `[${index + 1}]`;
        result += `${segment.text}${marker}`;
        annotations.push(
          `${marker} ${segment.color.toUpperCase()}: ${segment.reason || 'No reason provided'}`
        );
      } else {
        result += segment.text;
      }
    });

    if (annotations.length > 0) {
      result += '\n\n--- ANNOTATIONS ---\n' + annotations.join('\n');
    }

    return result;
  }

  /**
   * Create diff view comparing original and corrected text
   */
  static createDiff(
    originalMarkings: ColorMarking[],
    updatedMarkings: ColorMarking[]
  ): {
    added: ColorMarking[];
    removed: ColorMarking[];
    changed: ColorMarking[];
  } {
    const added: ColorMarking[] = [];
    const removed: ColorMarking[] = [];
    const changed: ColorMarking[] = [];

    // Find removed markings
    originalMarkings.forEach(original => {
      const stillExists = updatedMarkings.some(
        updated => 
          updated.startIndex === original.startIndex &&
          updated.endIndex === original.endIndex
      );
      
      if (!stillExists) {
        removed.push(original);
      }
    });

    // Find added and changed markings
    updatedMarkings.forEach(updated => {
      const original = originalMarkings.find(
        o => o.startIndex === updated.startIndex && o.endIndex === updated.endIndex
      );

      if (!original) {
        added.push(updated);
      } else if (original.color !== updated.color) {
        changed.push(updated);
      }
    });

    return { added, removed, changed };
  }

  // ===== HELPER METHODS =====

  private static escapeHTML(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, char => map[char]);
  }
}

// Export utility and types
export default ColorMarkingUtility;
