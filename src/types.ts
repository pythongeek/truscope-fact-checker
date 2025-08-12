export interface Source {
  title: string;
  url: string;
}

export interface RichSource extends Source {
  source_type: string; // Was a strict union, now flexible
  credibility_score: number;
  bias_rating: string; // Was a strict union, now flexible
}

export interface Claim {
  claim_text: string;
  status: string; // Was a strict union, now flexible
  confidence: number;
  explanation: string;
  consensus_status: "High Consensus" | "Conflicting Reports" | "Single Source" | "No Sources Found";
  is_anomaly: boolean;
  sources: RichSource[];
}

export interface MisinformationAlert {
  type: string; // Was a strict union, now flexible
  text: string;
  explanation: string;
}

export interface NewsStandards {
  accuracy: number;
  sourcing: number;
  neutrality: number;
  depth: number;
}

export interface LogicalFallacy {
  name: string;
  text: string;
  explanation: string;
}

export interface PropagandaTechnique {
  name: string;
  text: string;
  explanation: string;
}

export interface DeepAnalysis {
    logical_fallacies: LogicalFallacy[];
    propaganda_techniques: PropagandaTechnique[];
}

export interface AnalysisResult {
  factual_accuracy_score: number;
  misinformation_risk: number;
  news_standards_score: number;
  overall_summary: string;
  claims: Claim[];
  misinformation_alerts: MisinformationAlert[];
  editorial_suggestions: string[];
  enhanced_article_html: string;
  news_standards_analysis: NewsStandards;
  deep_analysis: DeepAnalysis;
  grounding_sources: Source[];
  claim_review_json_ld: string;
}

export type ActiveTab = "overview" | "claims" | "enhanced" | "standards" | "deep_analysis";
