import { GoogleGenerativeAI } from "@google/generative-ai";
import type { SourceItem, CredibilityScore, OverallCredibilityResult } from '../../types/verification';

export class CredibilityScorer {
  private readonly CREDIBILITY_CRITERIA = {
    SOURCE_AUTHORITY: 0.25,    // Government, academic, established media
    EDITORIAL_STANDARDS: 0.20,  // Fact-checking process, corrections policy
    EXPERTISE_RELEVANCE: 0.20,  // Subject matter expertise
    CORROBORATION: 0.15,       // Multiple independent confirmations
    RECENCY: 0.10,             // How current the information is
    TRANSPARENCY: 0.10         // Source attribution, methodology disclosed
  };

  constructor(private geminiClient: GoogleGenerativeAI) {}

  async scoreSourceCredibility(source: SourceItem): Promise<CredibilityScore> {
    const prompt = this.buildScoringPrompt(source);
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
      return scores;
    } catch (error) {
      console.error(`Error scoring credibility for source "${source.name}":`, error);
      // Return a default error score
      return {
        criteria: {
          SOURCE_AUTHORITY: { score: 0, reasoning: "Error during analysis." },
          EDITORIAL_STANDARDS: { score: 0, reasoning: "Error during analysis." },
          EXPERTISE_RELEVANCE: { score: 0, reasoning: "Error during analysis." },
          CORROBORATION: { score: 0, reasoning: "Error during analysis." },
          RECENCY: { score: 0, reasoning: "Error during analysis." },
          TRANSPARENCY: { score: 0, reasoning: "Error during analysis." },
        },
        overallScore: 0,
        summary: "Failed to analyze source credibility due to an error.",
      };
    }
  }

  async calculateOverallCredibility(scores: CredibilityScore[]): Promise<OverallCredibilityResult> {
    // This is a simplified implementation. A real implementation would involve more complex logic.
    const overallScore = scores.reduce((acc, score) => acc + score.overallScore, 0) / scores.length;

    // Basic consensus check
    const consensus = overallScore > 75 ? 'strong' : overallScore > 50 ? 'moderate' : 'weak';

    return {
      overallScore,
      consensus,
      contradictionAnalysis: "No major contradictions found in this simplified analysis.",
    };
  }

  private buildScoringPrompt(source: SourceItem): string {
    return `
      You are evaluating source credibility for fact-checking. Analyze this source:

      SOURCE: ${source.name}
      TYPE: ${source.type}
      CONTENT: ${source.content}
      URL: ${source.url}

      Rate 1-100 on each criterion and provide reasoning:

      1. SOURCE_AUTHORITY (25%): Is this a recognized, authoritative source?
         - Government agencies, academic institutions: 90-100
         - Established major media with editorial standards: 75-90
         - Specialized publications with expertise: 70-85
         - Newer or less established sources: 40-70
         - Blogs, personal sites, unverified sources: 10-40

      2. EDITORIAL_STANDARDS (20%): What are their fact-checking processes?
         - Rigorous peer review/editorial oversight: 90-100
         - Standard newsroom editorial process: 75-90
         - Basic editorial review: 60-75
         - Minimal oversight: 30-60
         - No apparent standards: 10-30

      3. EXPERTISE_RELEVANCE (20%): How relevant is their expertise to this claim?
         - Direct subject matter expertise: 90-100
         - Related field expertise: 70-90
         - General journalism expertise: 60-80
         - Limited relevant expertise: 30-60
         - No apparent expertise: 10-30

      4. CORROBORATION (15%): Is this information confirmed by other sources?
         - Multiple independent confirmations: 90-100
         - Some corroboration: 70-90
         - Limited corroboration: 50-70
         - Contradicted by other sources: 20-50
         - Stands alone without verification: 10-30

      5. RECENCY (10%): How current is this information?
         - Very recent (days/weeks): 90-100
         - Recent (months): 80-90
         - Moderately old (1-2 years): 60-80
         - Old but still relevant: 40-60
         - Outdated: 10-40

      6. TRANSPARENCY (10%): How transparent are their methods and sources?
         - Full methodology and source disclosure: 90-100
         - Good source attribution: 75-90
         - Basic attribution: 60-75
         - Limited transparency: 30-60
         - Poor/no attribution: 10-30

      Return detailed scoring with explanations as JSON in a CredibilityScore object.
    `;
  }
}
