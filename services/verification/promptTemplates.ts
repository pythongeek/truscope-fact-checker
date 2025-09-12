// File: services/verification/promptTemplates.ts

import type { SearchStrategy } from '../../types/verification';

export const VERIFICATION_PROMPTS = {

  GOVERNMENT_SOURCE_SIMULATION: `
You are accessing government and official sources for fact verification.
Using your knowledge of official government data, regulatory filings, and public records:

Claim to verify: "{claim}"

Provide information as if searched from:
- Official .gov websites and databases
- Regulatory agency reports and filings
- Congressional records and testimonies
- Court documents and legal filings
- International organization reports (UN, WHO, etc.)
- Government statistical databases

For each source, provide:
- Specific agency/department name
- Document title and date
- Relevant excerpt that supports or contradicts the claim
- URL where this would typically be found
- Confidence level of the information

Format as realistic government source citations with specific details.
  `,

  ACADEMIC_SOURCE_SIMULATION: `
You are accessing academic and research sources for fact verification.
Using your knowledge of scientific literature and academic research:

Claim to verify: "{claim}"

Provide information as if searched from:
- PubMed/medical literature databases
- arXiv preprint server
- Google Scholar academic papers
- University institutional repositories
- Professional journal articles
- Conference proceedings and presentations

For each source, provide:
- Journal name and publication details
- Author names and affiliations
- Study methodology and sample size
- Key findings relevant to the claim
- Peer review status
- Citation metrics if relevant

Format as proper academic citations with DOI/PMID where applicable.
  `,

  NEWS_VERIFICATION_SIMULATION: `
You are accessing major news sources for fact verification.
Using your knowledge of news reporting and journalism:

Claim to verify: "{claim}"

Provide information as if searched from:
- Wire services (Associated Press, Reuters, Bloomberg)
- Major newspapers (New York Times, Wall Street Journal, Washington Post, Guardian)
- Broadcast networks (BBC, NPR, CNN, CBS News)
- Specialized publications (Politico, ProPublica, Foreign Affairs)
- International news sources

For each source, provide:
- Publication name and date
- Reporter/correspondent name
- Headline and key details
- Sources quoted in the article
- Editorial standards and fact-checking process
- Corrections or updates if any

Format as journalism citations with publication details.
  `,

  FACT_CHECK_ORGANIZATION_SIMULATION: `
You are accessing established fact-checking organizations.
Using your knowledge of professional fact-checking:

Claim to verify: "{claim}"

Provide information as if searched from:
- PolitiFact (with Truth-O-Meter ratings)
- FactCheck.org (University of Pennsylvania)
- Snopes (general fact-checking)
- AFP Fact Check (international)
- BBC Reality Check
- Washington Post Fact Checker

For each fact-check, provide:
- Organization name and reputation
- Specific rating or verdict given
- Methodology used for verification
- Sources consulted by fact-checkers
- Date of fact-check
- Any updates or corrections

Format as fact-checker citations with ratings and methodology.
  `,

  EXPERT_OPINION_SIMULATION: `
You are gathering expert opinions and analysis for fact verification.
Using your knowledge of subject matter experts:

Claim to verify: "{claim}"
Topic area: "{topic}"

Provide information as if gathered from:
- University professors and researchers
- Think tank scholars and analysts
- Industry professionals and executives
- Former government officials with relevant experience
- Professional association statements
- Expert testimony in relevant proceedings

For each expert source, provide:
- Expert name and credentials
- Institutional affiliation
- Specific expertise relevant to claim
- Opinion or analysis provided
- Track record and reputation
- Potential conflicts of interest

Format as expert opinion citations with qualifications.
  `
};

export const extractTopicFromClaim = (claim: string): string => {
  // This is a placeholder. A more sophisticated implementation would use NLP.
  const words = claim.split(' ');
  // Find the longest word, assume it is the topic.
  return words.reduce((a, b) => a.length > b.length ? a : b, '');
}

export const buildVerificationPrompt = (
  claim: string,
  strategy: SearchStrategy
): string => {
  const promptKey = (strategy.search_type.toUpperCase() + '_SOURCE_SIMULATION') as keyof typeof VERIFICATION_PROMPTS;
  const basePrompt = VERIFICATION_PROMPTS[promptKey];

  if (!basePrompt) {
    throw new Error(`Invalid search strategy type: ${strategy.search_type}`);
  }

  return basePrompt
    .replace('{claim}', claim)
    .replace('{topic}', extractTopicFromClaim(claim));
};
