// src/services/factCheckAssistantService.ts
import { geminiService } from './geminiService';
import { FactCheckReport, ChatMessage } from '@/types';

export const factCheckAssistantService = {
  async getAssistantResponse(
    report: FactCheckReport,
    chatHistory: ChatMessage[],
    userQuery: string,
    originalContent: string // Added to accept the original content
  ): Promise<string> {

    // Create a context from the report and original content
    const reportContext = `
      Original Article:
      ${originalContent}

      Fact-Check Report Summary:
      - Overall Score: ${report.overallScore}/100
      - Main Conclusion: ${report.summary}
      - Claims Analyzed: ${(report.claims || []).map(c =>
        `Claim: "${c.claimText}" -> Verdict: ${c.assessment.status} (Confidence: ${Math.round(c.assessment.confidence * 100)}%). Explanation: ${c.assessment.explanation}`
      ).join('\n') || 'No claims analyzed.'}
    `;

    const prompt = `
      You are an AI assistant for a fact-checking tool. Your primary directive is to answer user questions based *ONLY* on the provided "Fact-Check Report Summary", "Original Article" and the "Chat History".
      Do not invent information or use any external knowledge. If the answer is not in the provided context, state that clearly. Be concise and helpful.

      ---
      Context:
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
