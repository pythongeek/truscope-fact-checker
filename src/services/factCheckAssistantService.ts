// src/services/factCheckAssistantService.ts
import { vertexAiService } from './vertexAiService';
import { FactCheckReport, ChatMessage, ClaimVerification, EvidenceItem } from '@/types';

// Assistant capabilities enumeration
enum AssistantCapability {
  ANSWER_QUESTIONS = 'answer_questions',
  AUTO_CORRECT = 'auto_correct',
  GENERATE_SCHEMA = 'generate_schema',
  REWRITE_CONTENT = 'rewrite_content',
  VERIFY_CLAIM = 'verify_claim',
  EXPLAIN_EVIDENCE = 'explain_evidence',
  CONDUCT_RESEARCH = 'conduct_research',
  EDITORIAL_REVIEW = 'editorial_review'
}

interface AssistantContext {
  report: FactCheckReport;
  originalContent: string;
  chatHistory: ChatMessage[];
  userQuery: string;
}

export const factCheckAssistantService = {
  /**
   * Main entry point for assistant responses
   */
  async getAssistantResponse(
    report: FactCheckReport,
    chatHistory: ChatMessage[],
    userQuery: string,
    originalContent: string
  ): Promise<string> {
    const context: AssistantContext = {
      report,
      originalContent,
      chatHistory,
      userQuery
    };

    try {
      // Detect user intent and route to appropriate handler
      const intent = this.detectUserIntent(userQuery);
      
      console.log(`🤖 Assistant Intent Detected: ${intent}`);

      switch (intent) {
        case AssistantCapability.AUTO_CORRECT:
          return await this.handleAutoCorrect(context);
        
        case AssistantCapability.GENERATE_SCHEMA:
          return await this.handleSchemaGeneration(context);
        
        case AssistantCapability.REWRITE_CONTENT:
          return await this.handleContentRewrite(context);
        
        case AssistantCapability.VERIFY_CLAIM:
          return await this.handleClaimVerification(context);
        
        case AssistantCapability.EXPLAIN_EVIDENCE:
          return await this.handleEvidenceExplanation(context);
        
        case AssistantCapability.CONDUCT_RESEARCH:
          return await this.handleResearch(context);
        
        case AssistantCapability.EDITORIAL_REVIEW:
          return await this.handleEditorialReview(context);
        
        default:
          return await this.handleGeneralQuery(context);
      }
    } catch (error) {
      console.error("❌ Assistant API call failed:", error);
      return "I apologize, but I encountered an error processing your request. Please try rephrasing your question or check your API configuration.";
    }
  },

  /**
   * Detect user intent from query
   */
  detectUserIntent(query: string): AssistantCapability {
    const lowerQuery = query.toLowerCase();

    // Auto-correct detection
    if (lowerQuery.match(/\b(correct|fix|edit|improve|revise|auto.?correct)\b/)) {
      return AssistantCapability.AUTO_CORRECT;
    }

    // Schema generation detection
    if (lowerQuery.match(/\b(schema|structured data|json.?ld|seo markup|generate schema)\b/)) {
      return AssistantCapability.GENERATE_SCHEMA;
    }

    // Content rewrite detection
    if (lowerQuery.match(/\b(rewrite|rephrase|reformulate|reword|redraft)\b/)) {
      return AssistantCapability.REWRITE_CONTENT;
    }

    // Claim verification detection
    if (lowerQuery.match(/\b(verify|check|validate|confirm|is.*true|fact.?check)\b/)) {
      return AssistantCapability.VERIFY_CLAIM;
    }

    // Evidence explanation detection
    if (lowerQuery.match(/\b(evidence|source|citation|reference|proof|where did|explain.*finding)\b/)) {
      return AssistantCapability.EXPLAIN_EVIDENCE;
    }

    // Research detection
    if (lowerQuery.match(/\b(research|investigate|find out|look up|search for|more information)\b/)) {
      return AssistantCapability.CONDUCT_RESEARCH;
    }

    // Editorial review detection
    if (lowerQuery.match(/\b(review|editorial|quality|assess|rate|evaluate|journalism|accuracy)\b/)) {
      return AssistantCapability.EDITORIAL_REVIEW;
    }

    return AssistantCapability.ANSWER_QUESTIONS;
  },

  /**
   * Build comprehensive context for the AI
   */
  buildDetailedContext(context: AssistantContext): string {
    const { report, originalContent } = context;

    // Format evidence with full details
    const evidenceDetails = (report.evidence || [])
      .map((ev: EvidenceItem, idx: number) => {
        const pubDate = ev.publicationDate || ev.publishedDate || 'Date unknown';
        const credRating = ev.credibilityScore >= 80 ? 'HIGH' : ev.credibilityScore >= 60 ? 'MEDIUM' : 'LOW';
        
        return `
[${idx + 1}] ${ev.title || 'Untitled'}
   Publisher: ${ev.publisher || ev.source?.name || 'Unknown'}
   URL: ${ev.url || 'No URL'}
   Published: ${pubDate}
   Credibility: ${credRating} (${ev.credibilityScore}/100)
   Type: ${ev.type || 'unknown'}
   Snippet: "${(ev.snippet || ev.quote || '').substring(0, 200)}..."
   Relevance: ${ev.relevanceScore || 'N/A'}/100
        `.trim();
      })
      .join('\n\n');

    // Format claim verifications
    const claimsAnalysis = (report.claimVerifications || [])
      .map((claim: ClaimVerification, idx: number) => {
        return `
Claim ${idx + 1}: "${claim.claimText || claim.claim}"
   Status: ${claim.status}
   Confidence: ${Math.round((claim.confidenceScore || claim.confidence || 0) * 100)}%
   Explanation: ${claim.explanation || claim.reasoning || 'No explanation provided'}
        `.trim();
      })
      .join('\n\n');

    // Safely get category rating info
    const categoryRating = report.categoryRating || report.category_rating;
    const categoryInfo = categoryRating ? `
Category Rating: ${categoryRating.category || 'Not rated'}
Rating Reasoning: ${categoryRating.reasoning || 'No reasoning provided'}
` : 'Category Rating: Not available';

    // Build comprehensive context
    return `
=== ORIGINAL CONTENT ===
${originalContent}

=== FACT-CHECK REPORT ===
Overall Score: ${report.finalScore || report.final_score || 0}/100
Verdict: ${report.finalVerdict || report.final_verdict || 'Unknown'}
Reasoning: ${report.reasoning || report.summary || 'No reasoning provided'}

${categoryInfo}

=== CLAIMS ANALYZED ===
${claimsAnalysis || 'No claims analyzed'}

=== EVIDENCE SOURCES (${report.evidence?.length || 0} total) ===
${evidenceDetails || 'No evidence collected'}

=== METADATA ===
Method Used: ${report.metadata?.methodUsed || report.metadata?.method_used || 'Unknown'}
Processing Time: ${report.metadata?.processingTimeMs || report.metadata?.processing_time_ms || 0}ms
APIs Used: ${(report.metadata?.apisUsed || []).join(', ') || 'None'}
High Credibility Sources: ${report.metadata?.sourcesConsulted?.highCredibility || report.metadata?.sources_consulted?.highCredibility || 0}
Warnings: ${(report.metadata?.warnings || []).join('; ') || 'None'}

${report.sourceCredibilityReport || report.source_credibility_report ? `
=== SOURCE CREDIBILITY ===
Overall Score: ${report.sourceCredibilityReport?.overallScore || report.source_credibility_report?.overallScore || 0}/100
High Credibility Sources: ${report.sourceCredibilityReport?.highCredibilitySources || report.source_credibility_report?.highCredibilitySources || 0}
Flagged Sources: ${report.sourceCredibilityReport?.flaggedSources || report.source_credibility_report?.flaggedSources || 0}
Bias Warnings: ${(report.sourceCredibilityReport?.biasWarnings || report.source_credibility_report?.biasWarnings || []).join('; ') || 'None'}
` : ''}

${report.temporalVerification || report.temporal_verification ? `
=== TEMPORAL VERIFICATION ===
Has Temporal Claims: ${report.temporalVerification?.hasTemporalClaims || report.temporal_verification?.hasTemporalClaims || false}
Temporal Score: ${report.temporalVerification?.overallTemporalScore || report.temporal_verification?.overallTemporalScore || 0}/100
Temporal Warnings: ${(report.temporalVerification?.temporalWarnings || report.temporal_verification?.temporalWarnings || []).join('; ') || 'None'}
` : ''}
    `.trim();
  },

  /**
   * Handle general queries
   */
  async handleGeneralQuery(context: AssistantContext): Promise<string> {
    const { chatHistory, userQuery } = context;
    const detailedContext = this.buildDetailedContext(context);

    const prompt = `You are Verity, an expert AI fact-checking and editorial assistant. You help journalists, writers, and content creators verify information, improve content accuracy, and maintain editorial standards.

CAPABILITIES YOU HAVE:
- Answer questions about the fact-check report and evidence
- Auto-correct content based on fact-check findings
- Generate Schema.org markup for fact-checked content
- Rewrite content to be more factually accurate
- Verify specific claims with additional research
- Explain evidence sources and their credibility
- Conduct additional research using available APIs
- Provide editorial reviews and journalism quality ratings

CONTEXT:
${detailedContext}

CHAT HISTORY:
${chatHistory.map(m => `${m.role === 'user' ? 'User' : 'Verity'}: ${m.content}`).join('\n')}

USER QUERY: "${userQuery}"

INSTRUCTIONS:
- Answer based on the fact-check report and evidence provided
- Always cite specific evidence sources by their number [1], [2], etc.
- If the answer isn't in the report, say so clearly
- Suggest relevant actions the user can take (auto-correct, schema generation, etc.)
- Be concise but thorough
- Use a professional but friendly tone

YOUR RESPONSE:`;

    return await vertexAiService.generateText(prompt);
  },

  /**
   * Handle auto-correct requests
   */
  async handleAutoCorrect(context: AssistantContext): Promise<string> {
    const { originalContent, report } = context;
    const detailedContext = this.buildDetailedContext(context);

    const prompt = `You are Verity, an AI editorial assistant. The user wants to auto-correct their content based on the fact-check findings.

${detailedContext}

TASK: Provide specific corrections for the original content based on the fact-check evidence.

For each correction:
1. Quote the problematic phrase from the original
2. Suggest a corrected version
3. Cite the evidence source that supports the correction
4. Explain why the correction improves accuracy

Format your response as:

**Suggested Corrections:**

**Issue 1:**
- Original: "[exact quote]"
- Corrected: "[improved version]"
- Evidence: [cite source number]
- Reason: [brief explanation]

[Continue for all issues found]

**Summary:**
[Overall assessment of content accuracy and improvement recommendations]

If the content is already accurate, say so and suggest minor improvements for clarity or style.

YOUR RESPONSE:`;

    const response = await vertexAiService.generateText(prompt);
    
    return `${response}\n\n💡 **Tip:** Once you review these corrections, I can help you apply them automatically or generate a fully corrected version of your content.`;
  },

  /**
   * Handle schema generation requests
   */
  async handleSchemaGeneration(context: AssistantContext): Promise<string> {
    const { report, originalContent } = context;

    const prompt = `You are Verity, an AI assistant helping generate Schema.org ClaimReview markup for fact-checked content.

FACT-CHECK REPORT:
- Verdict: ${report.finalVerdict || report.final_verdict}
- Score: ${report.finalScore || report.final_score}/100
- Original Text: "${originalContent.substring(0, 200)}..."
- Date Checked: ${new Date().toISOString()}

TASK: Explain what Schema.org markup is and provide a preview of the ClaimReview schema that would be generated for this fact-check.

Include:
1. Brief explanation of Schema.org and why it's important for SEO
2. Preview of the ClaimReview JSON-LD structure
3. How this will appear in search results
4. Instructions for implementing it

YOUR RESPONSE:`;

    const response = await vertexAiService.generateText(prompt);
    
    return `${response}\n\n💡 **Ready to generate?** I can create the complete Schema.org markup with proper formatting when you're ready. Just say "generate the schema" or "create schema markup".`;
  },

  /**
   * Handle content rewrite requests
   */
  async handleContentRewrite(context: AssistantContext): Promise<string> {
    const { originalContent, report } = context;
    const detailedContext = this.buildDetailedContext(context);

    const prompt = `You are Verity, an expert content editor. The user wants to rewrite their content to be more factually accurate.

${detailedContext}

ORIGINAL CONTENT:
${originalContent}

TASK: Rewrite the content to be factually accurate based on the evidence, while maintaining:
- The original tone and style
- The core message (if factually sound)
- Readability and flow
- Professional journalism standards

Provide:
1. A complete rewritten version
2. A summary of key changes made
3. Explanation of how the rewrite improves factual accuracy

Format:
**REWRITTEN CONTENT:**
[full rewritten version]

**KEY CHANGES:**
- [change 1 with evidence citation]
- [change 2 with evidence citation]
[etc.]

**ACCURACY IMPROVEMENT:**
[explanation of how rewrite is more accurate]

YOUR RESPONSE:`;

    return await vertexAiService.generateText(prompt);
  },

  /**
   * Handle claim verification requests
   */
  async handleClaimVerification(context: AssistantContext): Promise<string> {
    const { userQuery } = context;
    const detailedContext = this.buildDetailedContext(context);

    // Extract the specific claim from the query
    const claimMatch = userQuery.match(/(?:verify|check|is.*true|fact.?check)\s+["']?(.+?)["']?(?:\?|$)/i);
    const specificClaim = claimMatch ? claimMatch[1] : userQuery;

    const prompt = `You are Verity, a fact-checking AI assistant. The user wants to verify a specific claim.

${detailedContext}

CLAIM TO VERIFY: "${specificClaim}"

TASK: 
1. Check if this claim appears in the original content or fact-check report
2. Find relevant evidence from the report that addresses this claim
3. Provide a clear verdict: TRUE, FALSE, MIXED, or UNVERIFIED
4. Cite specific evidence sources
5. Explain your reasoning

If the claim is NOT in the current report, say so and offer to conduct additional research.

Format your response as:
**Claim:** [restate the claim clearly]
**Verdict:** [TRUE/FALSE/MIXED/UNVERIFIED]
**Confidence:** [percentage]
**Evidence:**
- [Evidence 1 with source citation]
- [Evidence 2 with source citation]
**Reasoning:** [clear explanation]

YOUR RESPONSE:`;

    const response = await vertexAiService.generateText(prompt);
    
    return `${response}\n\n💡 **Need more evidence?** I can conduct additional research using news sources and search APIs if needed. Just ask!`;
  },

  /**
   * Handle evidence explanation requests
   */
  async handleEvidenceExplanation(context: AssistantContext): Promise<string> {
    const { userQuery } = context;
    const detailedContext = this.buildDetailedContext(context);

    const prompt = `You are Verity, helping explain the evidence and sources used in the fact-check.

${detailedContext}

USER QUESTION: "${userQuery}"

TASK: Explain the evidence sources in detail, including:
- Which sources are most credible and why
- What each source says about the claim
- Any conflicts or contradictions between sources
- How publication dates affect relevance
- Source bias or credibility concerns
- How to access the original sources

Be specific and cite source numbers [1], [2], etc.

YOUR RESPONSE:`;

    return await vertexAiService.generateText(prompt);
  },

  /**
   * Handle research requests (additional verification)
   */
  async handleResearch(context: AssistantContext): Promise<string> {
    const { userQuery } = context;

    const response = `I can conduct additional research for you using:
- **Serper API**: Real-time web search
- **Webz API**: Recent news articles
- **Gemini AI**: Advanced analysis

To perform research, I need to know:
1. **What specific information** are you looking for?
2. **What timeframe** is relevant? (recent news, historical data, etc.)
3. **What type of sources** do you prefer? (news, academic, government, etc.)

Please provide more details about what you'd like me to research, and I'll use the available APIs to find additional evidence.

Example requests:
- "Research recent news about [topic]"
- "Find academic sources for [claim]"
- "Look up government data on [statistics]"
- "Verify if [event] happened on [date]"

What would you like me to investigate?`;

    return response;
  },

  /**
   * Handle editorial review requests
   */
  async handleEditorialReview(context: AssistantContext): Promise<string> {
    const { originalContent } = context;
    const detailedContext = this.buildDetailedContext(context);

    const prompt = `You are Verity, an expert editorial reviewer with journalism expertise. Provide a comprehensive editorial assessment.

${detailedContext}

ORIGINAL CONTENT:
${originalContent}

TASK: Provide a professional editorial review covering:

**FACTUAL ACCURACY** (Rate: Excellent/Good/Fair/Poor)
- Accuracy of claims
- Quality of evidence
- Verification status

**EDITORIAL QUALITY** (Rate: Excellent/Good/Fair/Poor)
- Writing clarity
- Objectivity and bias
- Source attribution
- Balanced coverage

**JOURNALISTIC STANDARDS** (Rate: Excellent/Good/Fair/Poor)
- Ethical considerations
- Fact-checking rigor
- Transparency
- Accountability

**RECOMMENDATIONS**
- Must fix: [critical issues]
- Should improve: [important improvements]
- Consider: [optional enhancements]

**OVERALL RATING**: [X/10]
**PUBLICATION READINESS**: [Ready/Minor Revisions Needed/Major Revisions Needed/Not Ready]

Provide specific, actionable feedback with evidence citations.

YOUR RESPONSE:`;

    return await vertexAiService.generateText(prompt);
  }
};
