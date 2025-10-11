// src/types/index.ts

export interface ApiKeys {
  gemini?: string;
  geminiModel?: string;
  factCheck?: string;
  search?: string;
  searchId?: string;
}

export interface Evidence {
  quote: string;
  publisher: string;
  url?: string;
  score: number;
  publishedDate?: string;
  relevance?: number;
  tier?: string;
}

export interface TierBreakdown {
  tier: string;
  success: boolean;
  confidence: number;
  evidence?: Evidence[];
  processingTime: number;
  escalationReason?: string;
}

export interface FactCheckMetadata {
  processing_time_ms: number;
  tier_breakdown?: TierBreakdown[];
  method_used?: string;
  model?: string;
  timestamp?: string;
  version?: string;
}

export interface ClaimVerification {
  claim: string;
  status: 'TRUE' | 'FALSE' | 'MIXED' | 'UNVERIFIED' | 'MISLEADING';
  confidence: number;
  evidence: Evidence[];
  explanation?: string;
}

export interface FactCheckReport {
  final_score: number;
  final_verdict: 'TRUE' | 'FALSE' | 'MIXED' | 'UNVERIFIED' | 'MISLEADING';
  reasoning: string;
  evidence: Evidence[];
  metadata?: FactCheckMetadata;
  claimVerifications?: ClaimVerification[];
  overallAuthenticityScore?: number;
  suggestions?: string[];
  warnings?: string[];
  timestamp?: string;
}

export interface EditorResult {
  correctedText: string;
  changesApplied: Array<{
    description: string;
    original?: string;
    corrected?: string;
    type?: string;
  }>;
  summary?: string;
  improvementScore?: number;
}

export interface SchemaData {
  schema: any;
  htmlSnippet: string;
  validation: {
    isValid: boolean;
    errors?: string[];
    warnings?: string[];
  };
}

export interface HistoryItem {
  id: string;
  timestamp: string;
  content: string;
  result: FactCheckReport;
  publishingContext?: string;
}

export interface TrendingItem {
  id: string;
  claim: string;
  category: string;
  trend: 'rising' | 'falling' | 'stable';
  verificationCount: number;
  lastVerified: string;
  averageScore: number;
  sources: string[];
}

export interface SettingsConfig {
  apiKeys: ApiKeys;
  preferences?: {
    theme?: 'light' | 'dark';
    autoSave?: boolean;
    citationStyle?: 'ap' | 'apa' | 'chicago';
    language?: string;
  };
}

export interface AnalysisConfig {
  text: string;
  publishingContext: string;
  config: {
    gemini: string;
    geminiModel: string;
    factCheck?: string;
    search?: string;
    searchId?: string;
  };
  options?: {
    deepAnalysis?: boolean;
    includeSuggestions?: boolean;
    minimumSources?: number;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp?: string;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'down';
  services: {
    gemini: boolean;
    search: boolean;
    database: boolean;
  };
  timestamp: string;
}

export interface PublishingContext {
  id: string;
  label: string;
  description: string;
  guidelines: string[];
  icon: string;
}

export type ViewType = 'checker' | 'history' | 'trending';
export type TabType = 'analyze' | 'report' | 'edit';
export type ApiStatus = 'checking' | 'available' | 'unavailable';
export type CorrectionMode = 'basic' | 'enhanced' | 'conservative' | 'aggressive';

export interface ComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export interface SidebarProps extends ComponentProps {
  isOpen: boolean;
  onClose: () => void;
  currentView: ViewType;
  onNavigate: (view: ViewType) => void;
  onSettingsClick: () => void;
}

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (keys: ApiKeys) => void;
  currentKeys: ApiKeys;
  availableModels: string[];
  isLoadingModels: boolean;
}

export interface SchemaInputFormProps {
  factCheckResult: FactCheckReport | null;
  onGenerate: (formData: any) => void;
  onClose: () => void;
}

export interface HistoryViewProps {
  onSelectReport: (report: FactCheckReport, claimText: string) => void;
}

export interface TabNavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  hasResult: boolean;
  correctionCount: number;
}

export interface AnalysisPanelProps {
  content: string;
  setContent: (content: string) => void;
  publishingContext: string;
  setPublishingContext: (context: string) => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
}

export interface ReportPanelProps {
  result: FactCheckReport;
  onAutoCorrect: (mode: CorrectionMode) => void;
  onShowSchema: () => void;
  isProcessing: boolean;
}

export interface EditorialPanelProps {
  originalContent: string;
  result: FactCheckReport;
  editorResult: EditorResult | null;
  onContentUpdate: (content: string) => void;
}

export interface SchemaPreviewModalProps {
  schema: any;
  htmlSnippet: string;
  validation: SchemaData['validation'];
  onClose: () => void;
}
