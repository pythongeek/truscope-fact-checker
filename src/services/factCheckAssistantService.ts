// src/services/factCheckAssistantService.ts
import { geminiService } from './geminiService'; // Your existing Gemini service
import { TieredFactCheckResult } from '@/types';
import { ChatMessage } from '@/types';

export const factCheckAssistantService = {
  async getAssistantResponse(
    report: TieredFactCheckResult,
    chatHistory: ChatMessage[],
    userQuery: string
  ): Promise<string> {

    // Condense the report into a compact context string.
    const reportContext = `
      Fact-Check Report Summary:
      - Overall Score: ${report.overallAuthenticityScore}/100
      - Main Conclusion: ${report.summary}
      - Claims Analyzed: ${(report.claimVerifications || []).map(c =>
        `Claim: "${c.claimText}" -> Verdict: ${c.status} (Confidence: ${Math.round(c.confidenceScore * 100)}%). Explanation: ${c.explanation}`
      ).join('\n') || 'No claims analyzed.'}
    `;

    const prompt = `
      You are an AI assistant for a fact-checking tool. Your primary directive is to answer user questions based *ONLY* on the provided "Fact-Check Report Summary" and the "Chat History".
      Do not invent information or use any external knowledge. If the answer is not in the provided context, state that clearly. Be concise and helpful.

      ---
      Fact-Check Report Summary:
      ${reportContext}
      ---
      Chat History:
      ${chatHistory.map(m => `${m.role}: ${m.content}`).join('\n')}
      ---
      New User Question: "${userQuery}"

      Your Answer:
    `;

    try {
        const response = await geminiService.generateText(prompt);
        return response;
    } catch (error) {
        console.error("Assistant API call failed:", error);
        return "I'm sorry, I encountered an error while processing your request.";
    }
  },
};
