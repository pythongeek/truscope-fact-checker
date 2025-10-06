
import { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

interface AutoCorrectRequest {
  text: string;
  factCheckResult: any; // Using any for flexibility with the fact-check result structure
  mode: 'journalism' | 'editorial' | 'content';
}

// Simplified EditorResult for the backend
interface EditorResult {
  mode: string;
  originalText: string;
  editedText: string;
  changesApplied: any[];
  improvementScore: number;
  processingTime: number;
  confidence: number;
}

// Function to build the prompt for Gemini
function buildAutoCorrectPrompt(text: string, factCheckResult: any, mode: string): string {
  const evidenceSummary = (factCheckResult.evidence || []).map((e: any) =>
    `- ${e.publisher}: "${e.quote.substring(0, 100)}..." (Credibility: ${e.score}%)`
  ).join('\n');

  return `
    You are an AI-powered editorial assistant. Your task is to correct and enhance a given text based on fact-checking evidence and a specified publishing context.

    PUBLISHING CONTEXT: ${mode}
    (Guidelines: ${mode === 'journalism' ? 'AP Style, neutrality, two-source rule' : mode === 'editorial' ? 'Clarity, supporting arguments' : 'Readability, engagement'})

    ORIGINAL TEXT:
    "${text}"

    FACT-CHECKING EVIDENCE:
    - Overall Verdict: ${factCheckResult.final_verdict} (Score: ${factCheckResult.final_score}/100)
    - Key Evidence:
    ${evidenceSummary}

    YOUR TASKS:
    1.  **Generate Corrected Text**: Rewrite the original text to fix factual inaccuracies, improve clarity, and add citations based on the evidence. The tone should match the publishing context.
    2.  **Detail Changes**: List the specific changes you made in a structured format. Types can be 'addition', 'modification', or 'deletion'.
    3.  **Score Improvement**: Estimate an "Improvement Score" (0-100) reflecting how much better the edited text is.
    4.  **Confidence**: Provide a confidence score (0-100) for your corrections.

    Return ONLY a single valid JSON object in the following format:
    {
      "editedText": "The full corrected text...",
      "changesApplied": [
        { "type": "modification", "originalPhrase": "...", "newPhrase": "...", "reason": "...", "confidence": 95 },
        { "type": "addition", "originalPhrase": "", "newPhrase": "...", "reason": "...", "confidence": 90 }
      ],
      "improvementScore": 88,
      "confidence": 92
    }
  `;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const startTime = Date.now();
  const { text, factCheckResult, mode }: AutoCorrectRequest = req.body;

  if (!text || !factCheckResult) {
    res.status(400).json({ error: 'Text and factCheckResult are required.' });
    return;
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const prompt = buildAutoCorrectPrompt(text, factCheckResult, mode);

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text();

    // Clean and parse the JSON response from Gemini
    const cleanedJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const aiResult = JSON.parse(cleanedJson);

    const editorResult: EditorResult = {
      mode,
      originalText: text,
      editedText: aiResult.editedText,
      changesApplied: aiResult.changesApplied,
      improvementScore: aiResult.improvementScore,
      processingTime: Date.now() - startTime,
      confidence: aiResult.confidence,
    };

    res.status(200).json(editorResult);
  } catch (error: any) {
    console.error('❌ Auto-correction failed:', error);
    res.status(500).json({
      error: 'Auto-correction failed',
      details: error.message,
    });
  }
}
