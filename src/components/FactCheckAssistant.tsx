import { FactCheckReport, ChatMessage, Evidence } from '@/types';
import { generateText } from './geminiService';
import { logger } from '../utils/logger';
import { getApiKeys } from './apiKeyService';

/**
 * Defines the tools that the AI assistant can use.
 * This is the core of the new functionality.
 */
const tools = [
  {
    name: 'auto_correct_content',
    description: 'Applies automated corrections to the article based on the fact-check report. Use this when the user wants to fix inaccuracies.',
    parameters: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          description: "The correction mode. Always use 'enhanced' for the best results.",
        },
      },
      required: ['mode'],
    },
  },
  {
    name: 'generate_schema_markup',
    description: 'Generates JSON-LD schema markup for the fact-check report, which is useful for SEO. Use this when the user asks for "schema", "markup", or "SEO".',
    parameters: {
      type: 'object',
      properties: {}, // No parameters needed for this tool
    },
  },
  {
    name: 'rewrite_text',
    description: 'Rewrites a given piece of text to be more factually accurate, neutral, or in a specific style (e.g., journalistic).',
    parameters: {
      type: 'object',
      properties: {
        textToRewrite: {
          type: 'string',
          description: 'The specific text segment the user wants to be rewritten.',
        },
        persona: {
            type: 'string',
            description: 'The expert persona to adopt for the rewrite (e.g., "Journalist", "Content Expert").'
        }
      },
      required: ['textToRewrite', 'persona'],
    },
  },
];

/**
 * Builds the comprehensive prompt for the Gemini model, including its new persona,
 * tool definitions, and full access to the report data.
 */
const buildPrompt = (report: FactCheckReport, chatHistory: ChatMessage[], originalContent: string): string => {
  const reportContext = `
    **Fact-Check Report Context:**
    - **Original Claim**: "${report.originalText}"
    - **Final Verdict**: ${report.finalVerdict}
    - **Overall Score**: ${report.finalScore}/100
  `;

  return `
    You are Verity, an expert AI editorial assistant with the persona of a seasoned journalist and content expert.
    Your mission is to help the user improve their content using the provided fact-check report and a set of powerful editorial tools.

    **Core Instructions:**
    1.  **Be a Proactive Editor**: Do not just be a chatbot. You are a co-editor. Your role is to guide the user through the editorial process.
    2.  **Understand the Tools**: You have access to tools for auto-correction, schema generation, and text rewriting. When a user's request maps to one of these tools, you must respond with a JSON object to call that tool.
    3.  **Initiate Action**: If the user's request is ambiguous, suggest a tool. For example, if they say "this article has problems," you should ask, "Would you like me to run the auto-corrector to fix the inaccuracies based on the report?"
    4.  **Adopt Your Persona**: When rewriting content or giving feedback, speak as a journalist or content expert. Use terms like "accuracy," "sourcing," "neutrality," and "clarity."
    5.  **Tool Call Format**: When you need to use a tool, respond *only* with a JSON object in the format: { "tool": "tool_name", "parameters": { "param_name": "value" } }.

    **Available Tools:**
    ${JSON.stringify(tools, null, 2)}

    **Full Content for Analysis:**
    \`\`\`
    ${originalContent}
    \`\`\`

    **Fact-Check Report:**
    ${reportContext}
    (You also have access to the full evidence list in the background)

    **Conversation History:**
    ${chatHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

    Analyze the user's latest request and decide whether to respond with conversational text or a tool call JSON.
  `;
};

export const factCheckAssistantService = {
  /**
   * Gets a response from the Gemini model, which could be a conversational reply
   * or a request to use an editorial tool.
   */
  async getAssistantResponse(
    report: FactCheckReport,
    chatHistory: ChatMessage[],
    userQuery: string,
    originalContent: string // The full text from the editor
  ): Promise<string> {
    // Add the latest user query to the history for the prompt
    const fullChatHistory = [...chatHistory, { role: 'user', content: userQuery, timestamp: Date.now() }];
    const prompt = buildPrompt(report, fullChatHistory, originalContent);

    const { gemini: geminiApiKey, geminiModel } = getApiKeys();

    if (!geminiApiKey) {
      const errorMessage = "A Gemini API key is required. Please add your key in the settings panel.";
      logger.error("Attempted to use assistant without a Gemini API key.");
      return errorMessage;
    }

    try {
      // The response from Gemini could be a tool call or a standard text response
      const response = await generateText(prompt, geminiApiKey, geminiModel || 'gemini-pro');
      return response;
    } catch (error) {
      logger.error('Assistant API call failed:', error);
      return "I'm sorry, I encountered a problem connecting to the AI service. Please check your API key and network connection.";
    }
  },
};
