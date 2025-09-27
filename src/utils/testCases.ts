export const temporalTestCases = [
  {
    description: "Past date should be valid",
    input: "In August 2025, the economy showed improvement",
    expected: { isValid: true, dateType: 'past' }
  },
  {
    description: "Recent past should be highly confident",
    input: "On 08/15/2025, the data indicated growth",
    expected: { isValid: true, confidence: 95 }
  },
  {
    description: "Far future should be flagged",
    input: "In 2030, we will have flying cars",
    expected: { isValid: false, dateType: 'far_future' }
  }
];

export const credibilityTestCases = [
  {
    description: "Academic source should have high credibility",
    domain: "nature.com",
    expected: { credibilityScore: 95, category: 'academic' }
  },
  {
    description: "Unknown domain should get heuristic analysis",
    domain: "randomnewssite.com",
    expected: { credibilityScore: 40, verificationStatus: 'unverified' }
  }
];

export const categoryTestCases = [
  {
    description: "High score with good evidence should be 'true'",
    input: { score: 92, evidenceQuality: 85, sourceCount: 5 },
    expected: { category: 'true', evidenceStrength: 'strong' }
  },
  {
    description: "Mixed score should be 'half-true'",
    input: { score: 55, evidenceQuality: 60, sourceCount: 3 },
    expected: { category: 'half-true', evidenceStrength: 'moderate' }
  }
];