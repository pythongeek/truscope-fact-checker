import { Router, Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/genai';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { prompt, config, maxTokens = 2000, apiKey } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: maxTokens,
      }
    });

    const response = result.response;
    const content = response.text();

    // Calculate confidence based on response quality (simplified)
    const confidence = Math.min(0.95, Math.max(0.6, content.length / 1000));

    return res.status(200).json({
      content,
      confidence,
      config,
      tokensUsed: content.split(' ').length
    });

  } catch (error) {
    console.error('AI Editor API error:', error);
    return res.status(500).json({
      error: 'Failed to process content',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
