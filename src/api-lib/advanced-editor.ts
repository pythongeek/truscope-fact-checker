
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, mode, prompt } = req.body;

    if (!text || !mode || !prompt) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Simple text processing based on mode
    let editedText = text;

    switch (mode) {
      case 'quick-fix':
        editedText = await applyQuickFixes(text);
        break;
      case 'enhanced':
        editedText = await enhanceText(text, prompt);
        break;
      case 'complete-rewrite':
        editedText = await rewriteText(text, prompt);
        break;
      default:
        editedText = text;
    }

    res.status(200).json({
      editedText,
      processingTime: Date.now(),
      confidence: 90
    });

  } catch (error) {
    console.error('Advanced editor API error:', error);
    res.status(500).json({ error: 'Failed to process text' });
  }
}

async function applyQuickFixes(text: string): Promise<string> {
  // Basic text cleaning and fixes
  return text
    .replace(/\s+/g, ' ') // Multiple spaces to single space
    .replace(/([.!?])\s*([A-Z])/g, '$1 $2') // Ensure space after sentence endings
    .replace(/,\s*,/g, ',') // Remove duplicate commas
    .replace(/\.\s*\./g, '.') // Remove duplicate periods
    .trim();
}

async function enhanceText(text: string, prompt: string): Promise<string> {
  // In a real implementation, you'd call an AI service here
  const sentences = text.split(/(?<=[.!?])\s+/);
  const enhancedSentences = sentences.map(sentence => {
    let enhanced = sentence.trim();
    if (enhanced.toLowerCase().startsWith('the ')) {
      enhanced = enhanced.replace(/^The /, Math.random() > 0.7 ? 'This ' : 'The ');
    }
    return enhanced;
  });
  return enhancedSentences.join(' ');
}

async function rewriteText(text: string, prompt: string): Promise<string> {
  // In a real implementation, you'd call an AI service here
  const paragraphs = text.split(/\n\s*\n/);
  const rewrittenParagraphs = paragraphs.map(paragraph => {
    const sentences = paragraph.split(/(?<=[.!?])\s+/);
    return sentences
      .filter(s => s.trim().length > 0)
      .map(sentence => {
        return sentence
          .replace(/\bvery\s+(\w+)/gi, (match, word) => {
            const strongerWords: Record<string, string> = {
              'good': 'excellent', 'bad': 'terrible', 'big': 'enormous',
              'small': 'tiny', 'important': 'crucial', 'interesting': 'fascinating'
            };
            return strongerWords[word.toLowerCase()] || match;
          })
          .trim();
      })
      .join(' ');
  });
  return rewrittenParagraphs.join('\n\n');
}
