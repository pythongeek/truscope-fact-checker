// src/services/analysis/SimpleIntelligentQuerySynthesizer.ts

import { vertexAiService } from '../vertexAiService';

export interface SynthesizedQueries {
  keywordQuery: string;
  contextualQuery: string;
}

/**
 * A simple version of the query synthesizer that uses a direct LLM prompt.
 */
export const simpleIntelligentQuerySynthesizer = {
  async generateQueries(claim: string): Promise<SynthesizedQueries> {
    const prompt = `
      Analyze the following journalistic claim. Your task is to generate two distinct search queries based on it.

      1.  **Keyword Query**: Extract the absolute key entities (people, organizations, specific events, locations, statistics). Combine them into a concise, keyword-based search string. Omit any filler words. This query is for finding direct, specific evidence.
      2.  **Contextual Query**: Identify the broader topic or process being discussed. Formulate a query that would find explanatory articles or background information about this topic. This query is for understanding the general context.

      Claim: "${claim}"

      Return your response as a valid JSON object with the keys "keywordQuery" and "contextualQuery".
      Example:
      Claim: "In the dim glow of a Fulton County courtroom, Derrick Groves listened as a judge approved his extradition to face charges of wire fraud filed in Ohio."
      JSON Response:
      {
        "keywordQuery": "Derrick Groves Fulton County extradition Ohio wire fraud",
        "contextualQuery": "interstate extradition process for wire fraud charges"
      }
    `;

    try {
      const result = await vertexAiService.generateText(prompt);
      const parsedResult: SynthesizedQueries = JSON.parse(result);
      return parsedResult;
    } catch (error) {
      console.error("Error synthesizing queries:", error);
      return {
        keywordQuery: claim.split(' ').slice(0, 10).join(' '),
        contextualQuery: ''
      };
    }
  },
};
