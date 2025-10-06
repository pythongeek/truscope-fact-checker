
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface Citation {
  url: string;
  publisher: string;
  quote: string;
}

interface ValidatedCitation extends Citation {
  isValid: boolean;
  accessibility: 'accessible' | 'inaccessible' | 'error';
  credibilityScore: number;
  warnings: string[];
}

// A simple mock credibility engine
const calculateCredibility = (url: string): { score: number; warnings: string[] } => {
  const warnings: string[] = [];
  let score = 75; // Base score

  if (url.includes('.gov') || url.includes('.edu')) {
    score += 15;
  } else if (url.includes('reuters.com') || url.includes('apnews.com')) {
    score += 10;
  } else if (url.includes('wikipedia.org')) {
    score -= 10;
    warnings.push('Wikipedia is a user-generated source and may not be reliable.');
  } else if (url.includes('blogspot.com') || url.includes('wordpress.com')) {
    score -= 25;
    warnings.push('Blog sources are generally not considered highly credible.');
  }

  if (url.startsWith('http://')) {
    warnings.push('Source does not use HTTPS, which is a security risk.');
    score -= 5;
  }

  // Clamp score between 0 and 100
  score = Math.max(0, Math.min(100, score));

  return { score, warnings };
};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  const { citations } = req.body as { citations: Citation[] };

  if (!citations || !Array.isArray(citations)) {
    return res.status(400).json({ error: 'Invalid request body. "citations" array is required.' });
  }

  try {
    const validationPromises = citations.map(async (citation): Promise<ValidatedCitation> => {
      const { url } = citation;
      let accessibility: 'accessible' | 'inaccessible' | 'error' = 'error';
      let isValid = false;

      try {
        // Simulate accessibility check
        const response = await fetch(url, { method: 'HEAD' });
        accessibility = response.ok ? 'accessible' : 'inaccessible';
        isValid = true;
      } catch (error) {
        // If fetch fails, it's likely inaccessible or an invalid URL
        accessibility = 'inaccessible';
        isValid = false;
      }

      const { score, warnings } = calculateCredibility(url);

      return {
        ...citation,
        isValid,
        accessibility,
        credibilityScore: score,
        warnings,
      };
    });

    const validatedCitations = await Promise.all(validationPromises);
    res.status(200).json({ citations: validatedCitations });
  } catch (error) {
    console.error('Error validating citations:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
