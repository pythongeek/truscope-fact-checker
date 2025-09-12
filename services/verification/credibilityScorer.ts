import { GoogleGenerativeAI } from "@google/generative-ai";
import type { EvidenceItem, ScoredEvidence } from '../../types/verification';

export class CredibilityScorer {
  constructor(private geminiClient: GoogleGenerativeAI) {}

  async scoreAllSources(evidence: EvidenceItem[]): Promise<ScoredEvidence[]> {
    const prompt = this.buildPrompt(evidence);
    const model = this.geminiClient.getGenerativeModel({ model: "gemini-1.5-flash" });

    try {
      const result = await model.generateContent(prompt);
      const response = result.response;
      const responseText = response.text();

      let jsonString = responseText.trim();
      const jsonMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        jsonString = jsonMatch[1];
      }

      const scores = JSON.parse(jsonString);
      // TODO: Add validation for the parsed scores

      return evidence.map((item, index) => ({
        ...item,
        credibilityScore: scores[index]?.credibilityScore || 0,
        isRelevant: scores[index]?.isRelevant || false,
      }));
    } catch (error) {
      console.error("Error scoring source credibility:", error);
      return evidence.map(item => ({
        ...item,
        credibilityScore: 0,
        isRelevant: false,
      }));
    }
  }

  private buildPrompt(evidence: EvidenceItem[]): string {
    const evidenceString = evidence.map((item, index) =>
      `Evidence ${index + 1}:
      - URL: ${item.url}
      - Title: ${item.title}
      - Snippet: ${item.snippet}`
    ).join('\n\n');

    return `
      You are an AI expert in source analysis and media literacy. Your task is to evaluate a list of evidence items based on their likely credibility and relevance to a fact-checking inquiry.

      Analyze the following evidence:
      ${evidenceString}

      For each evidence item, provide a JSON object with two keys:
      1. "credibilityScore": A number from 0 to 100, where 100 is highly credible. Consider factors like the source URL (e.g., .gov, .edu, major news outlets are generally more credible), the title's objectivity, and the snippet's tone.
      2. "isRelevant": a boolean value (true/false) indicating if the evidence is relevant to the likely claim being investigated.

      Return your response as a JSON array where each object corresponds to an evidence item in the same order.

      Example output:
      [
        { "credibilityScore": 95, "isRelevant": true },
        { "credibilityScore": 85, "isRelevant": true },
        { "credibilityScore": 40, "isRelevant": false }
      ]

      Now, generate the JSON for the provided evidence.
    `;
  }
}
