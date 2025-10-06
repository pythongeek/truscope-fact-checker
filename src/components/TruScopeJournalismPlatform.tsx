
import React, { useState, useEffect } from 'react';
// import { runTieredFactCheck } from '../services/tieredFactCheckService';
import { CitationValidatorService } from '../services/citationValidator';
import { AutoEditorIntegrationService, EditorMode } from '../services/autoEditorIntegration';
import {
  FileText, CheckCircle, AlertTriangle, Link as LinkIcon,
  Download, Copy, Check, X, Search, Edit3, BookOpen,
  Globe, Calendar, Award, Shield, ExternalLink, Info,
  RefreshCw, Settings, TrendingUp, Database
} from 'lucide-react';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface FactCheckResult {
  id: string;
  originalText: string;
  final_verdict: string;
  final_score: number;
  reasoning?: string;
  evidence: EvidenceItem[];
  metadata: {
    method_used: string;
    processing_time_ms: number;
    apis_used: string[];
    sources_consulted: {
      total: number;
      high_credibility: number;
      conflicting: number;
    };
    warnings: string[];
  };
  originalTextSegments?: TextSegment[];
  source_credibility_report?: CredibilityReport;
}

interface EvidenceItem {
  id: string;
  publisher: string;
  url: string | null;
  quote: string;
  score: number;
  type: string;
  publishedDate?: string;
  credibilityScore?: number;
  isValid?: boolean;
  accessibility?: 'accessible' | 'inaccessible' | 'error';
  warnings?: string[];
}

interface TextSegment {
  text: string;
  score: number;
  color: 'green' | 'yellow' | 'red' | 'default';
}

interface CredibilityReport {
  overallScore: number;
  highCredibilitySources: number;
  flaggedSources: number;
  biasWarnings: string[];
}

interface Correction {
  original: string;
  suggested: string;
  reasoning: string;
  confidence: number;
  type: 'factual-correction' | 'citation-addition' | 'style-correction';
}

interface EditorResult {
  mode: string;
  originalText: string;
  editedText: string;
  changesApplied: ContentChange[];
  improvementScore: number;
  processingTime: number;
  confidence: number;
}

interface ContentChange {
  type: 'addition' | 'modification' | 'deletion';
  originalPhrase: string;
  newPhrase: string;
  reason: string;
  confidence: number;
  position: { start: number; end: number };
}

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================

export default function TruScopeJournalismPlatform() {
  const [activeTab, setActiveTab] = useState<'analyze' | 'report' | 'edit'>('analyze');
  const [content, setContent] = useState('');
  const [publishingContext, setPublishingContext] = useState('journalism');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [factCheckResult, setFactCheckResult] = useState<FactCheckResult | null>(null);
  const [editorResult, setEditorResult] = useState<EditorResult | null>(null);
  const [showSchemaModal, setShowSchemaModal] = useState(false);
  const [apiStatus, setApiStatus] = useState<'checking' | 'available' | 'unavailable'>('checking');

  const handleAnalyze = async () => {
    console.log("Analyze clicked");
    // if (!content.trim()) {
    //   alert('Please enter content to analyze');
    //   return;
    // }

    // setIsAnalyzing(true);
    // setActiveTab('analyze');

    // try {
    //   // Use your existing fact-check orchestrator
    //   const result = await runTieredFactCheck(content, 'comprehensive');

    //   // Validate citations
    //   const citationService = CitationValidatorService.getInstance();
    //   const validation = await citationService.validateCitations(result.evidence);

    //   // Enhance evidence with validation data
    //   const enhancedEvidence = result.evidence.map(item => {
    //     const validated = validation.citations.find(c => c.url === item.url);
    //     if (validated) {
    //       return {
    //         ...item,
    //         isValid: validated.isValid,
    //         accessibility: validated.accessibility,
    //         credibilityScore: validated.credibilityScore,
    //         warnings: validated.warnings,
    //       };
    //     }
    //     return item;
    //   });

    //   // Combine warnings
    //   const allWarnings = [
    //     ...(result.metadata.warnings || []),
    //     ...validation.citations.flatMap(c => c.warnings || [])
    //   ];

    //   const finalResult: FactCheckResult = {
    //     ...result,
    //     evidence: enhancedEvidence,
    //     metadata: {
    //       ...result.metadata,
    //       warnings: allWarnings,
    //     },
    //   };

    //   setFactCheckResult(finalResult);
    //   setActiveTab('report');
    // } catch (error: any) {
    //   console.error('Analysis failed:', error);
    //   alert(`Analysis failed: ${error.message}`);
    // } finally {
    //   setIsAnalyzing(false);
    // }
  };

  const handleAutoCorrect = async (mode: string) => {
    if (!factCheckResult) return;

    setIsAnalyzing(true);

    try {
      const editorService = AutoEditorIntegrationService.getInstance();

      // Perform fact-check analysis first
      const analysis = await editorService.performFactCheckAnalysis(content);

      // Apply auto-correction
      const result = await editorService.performAutoCorrection(
        content,
        analysis,
        mode as EditorMode
      );

      setEditorResult(result);
      setActiveTab('edit');
    } catch (error: any) {
      console.error('Auto-correction failed:', error);
      alert(`Auto-correction failed: ${error.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateCorrectedText = (original: string, result: FactCheckResult): string => {
    let corrected = original;

    // Add citations from evidence
    result.evidence.slice(0, 2).forEach((ev, idx) => {
      const citation = ` [${idx + 1}]`;
      const insertPoint = Math.floor(corrected.length / (idx + 2));
      corrected = corrected.slice(0, insertPoint) + citation + corrected.slice(insertPoint);
    });

    // Add verification statement
    corrected += `\n\n**Fact-Check Verification**: This content has been verified with a confidence score of ${result.final_score}/100 based on ${result.evidence.length} independent sources.`;

    return corrected;
  };

  const generateSchema = () => {
    if (!factCheckResult) return null;

    return {
      "@context": "https://schema.org",
      "@type": "ClaimReview",
      "datePublished": new Date().toISOString().split('T')[0],
      "url": "https://your-publication.com/article/verification",
      "claimReviewed": factCheckResult.originalText.substring(0, 200),
      "author": {
        "@type": "Organization",
        "name": "TruScope Fact-Checking Team"
      },
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": factCheckResult.final_score.toString(),
        "bestRating": "100",
        "worstRating": "0",
        "alternateName": factCheckResult.final_verdict
      },
      "itemReviewed": {
        "@type": "Claim",
        "author": {
          "@type": "Organization",
          "name": factCheckResult.evidence[0]?.publisher || "Various Sources"
        },
        "datePublished": factCheckResult.evidence[0]?.publishedDate || new Date().toISOString().split('T')[0],
        "appearance": {
          "@type": "OpinionNewsArticle",
          "url": factCheckResult.evidence[0]?.url || "",
          "headline": "Verified Claim"
        }
      }
    };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">TruScope Professional</h1>
                <p className="text-sm text-gray-600">Enterprise Fact-Checking & Editorial Suite</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className={`px-4 py-2 rounded-lg text-sm font-medium ${
                apiStatus === 'available'
                  ? 'bg-green-100 text-green-700'
                  : apiStatus === 'unavailable'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-yellow-100 text-yellow-700'
              }`}>
                {apiStatus === 'checking' && '🔄 Checking...'}
                {apiStatus === 'available' && '✅ API Ready'}
                {apiStatus === 'unavailable' && '⚠️ API Offline'}
              </div>
              <span className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-sm font-semibold shadow-lg">
                Pro Edition
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Tab Navigation */}
        <TabNavigation
          activeTab={activeTab}
          onTabChange={setActiveTab}
          hasResult={!!factCheckResult}
          correctionCount={editorResult?.changesApplied.length || 0}
        />

        {/* Tab Content */}
        <div className="mt-6">
          {activeTab === 'analyze' && (
            <AnalysisPanel
              content={content}
              setContent={setContent}
              publishingContext={publishingContext}
              setPublishingContext={setPublishingContext}
              onAnalyze={handleAnalyze}
              isAnalyzing={isAnalyzing}
            />
          )}

          {activeTab === 'report' && factCheckResult && (
            <ReportPanel
              result={factCheckResult}
              onAutoCorrect={handleAutoCorrect}
              onShowSchema={() => setShowSchemaModal(true)}
              isProcessing={isAnalyzing}
            />
          )}

          {activeTab === 'edit' && factCheckResult && (
            <EditorialPanel
              originalContent={content}
              result={factCheckResult}
              editorResult={editorResult}
              onContentUpdate={setContent}
            />
          )}
        </div>
      </div>

      {/* Schema Modal */}
      {showSchemaModal && factCheckResult && (
        <SchemaPreviewModal
          schema={JSON.stringify(generateSchema(), null, 2)}
          onClose={() => setShowSchemaModal(false)}
        />
      )}
    </div>
  );
}
// ============================================================================
// TAB NAVIGATION COMPONENT
// ============================================================================

interface TabNavigationProps {
  activeTab: string;
  onTabChange: (tab: 'analyze' | 'report' | 'edit') => void;
  hasResult: boolean;
  correctionCount: number;
}

function TabNavigation({ activeTab, onTabChange, hasResult, correctionCount }: TabNavigationProps) {
  const tabs = [
    { id: 'analyze', label: 'Analyze Content', icon: Search, disabled: false },
    { id: 'report', label: 'Fact-Check Report', icon: FileText, disabled: !hasResult },
    { id: 'edit', label: 'Editorial Panel', icon: Edit3, disabled: !hasResult }
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2">
      <div className="flex space-x-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const isDisabled = tab.disabled;

          return (
            <button
              key={tab.id}
              onClick={() => !isDisabled && onTabChange(tab.id as any)}
              disabled={isDisabled}
              className={`
                flex-1 px-6 py-3 rounded-lg font-medium transition-all flex items-center justify-center space-x-2
                ${isActive
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                  : isDisabled
                  ? 'text-gray-400 cursor-not-allowed opacity-50'
                  : 'text-gray-700 hover:bg-gray-100'
                }
              `}
            >
              <Icon className="w-5 h-5" />
              <span>{tab.label}</span>
              {tab.id === 'edit' && correctionCount > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-yellow-500 text-white text-xs rounded-full">
                  {correctionCount}
                </span>
              )}
              {tab.id === 'report' && hasResult && (
                <span className="ml-2 px-2 py-0.5 bg-green-500 text-white text-xs rounded-full">
                  Ready
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// ANALYSIS PANEL COMPONENT
// ============================================================================

interface AnalysisPanelProps {
  content: string;
  setContent: (content: string) => void;
  publishingContext: string;
  setPublishingContext: (context: string) => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
}

function AnalysisPanel({
  content,
  setContent,
  publishingContext,
  setPublishingContext,
  onAnalyze,
  isAnalyzing
}: AnalysisPanelProps) {
  const contexts = [
    {
      id: 'journalism',
      label: 'Journalism & News',
      icon: Globe,
      description: 'AP Style, multiple source verification',
      guidelines: ['Two-source rule', 'Attribution required', 'Fact-check priority']
    },
    {
      id: 'editorial',
      label: 'Editorial & Opinion',
      icon: BookOpen,
      description: 'Opinion with fact-based support',
      guidelines: ['Clearly label opinion', 'Support with evidence', 'Disclosure required']
    },
    {
      id: 'content',
      label: 'Content Writing',
      icon: FileText,
      description: 'Blog posts, articles, marketing',
      guidelines: ['SEO best practices', 'Readability focus', 'Source linking']
    }
  ];

  return (
    <div className="space-y-6">
      {/* Publishing Context Selector */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Publishing Context</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {contexts.map((ctx) => {
            const Icon = ctx.icon;
            return (
              <button
                key={ctx.id}
                onClick={() => setPublishingContext(ctx.id)}
                className={`
                  p-4 rounded-lg border-2 transition-all text-left
                  ${publishingContext === ctx.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                  }
                `}
              >
                <div className="flex items-start space-x-3">
                  <Icon className={`w-6 h-6 mt-0.5 ${publishingContext === ctx.id ? 'text-blue-600' : 'text-gray-400'}`} />
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">{ctx.label}</h4>
                    <p className="text-sm text-gray-600 mt-1">{ctx.description}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {ctx.guidelines.map((guide) => (
                        <span key={guide} className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                          {guide}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Input */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Content to Verify</h3>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Paste your article, news content, or claim here for comprehensive fact-checking..."
          className="w-full h-64 p-4 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all resize-none"
        />
        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-gray-600">
            {content.split(/\s+/).filter(Boolean).length} words
          </span>
          <button
            onClick={onAnalyze}
            disabled={isAnalyzing || !content.trim()}
            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Analyzing...</span>
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                <span>Analyze Content</span>
              </>
            )}
          </button>
        </div>
      </div>

    </div>
  );
}

// ============================================================================
// EDITORIAL PANEL COMPONENT
// ============================================================================

interface EditorialPanelProps {
  originalContent: string;
  result: FactCheckResult;
  editorResult: EditorResult | null;
  onContentUpdate: (content: string) => void;
}

function EditorialPanel({ originalContent, result, editorResult, onContentUpdate }: EditorialPanelProps) {
  const [editedContent, setEditedContent] = useState(editorResult?.editedText || originalContent);
  const [showDiff, setShowDiff] = useState(true);
  const [citationStyle, setCitationStyle] = useState<'apa' | 'mla' | 'chicago'>('apa');

  const corrections: Correction[] = React.useMemo(() => {
    const correctionsList: Correction[] = [];

    // Generate corrections from low-scoring segments
    if (result.originalTextSegments) {
      result.originalTextSegments.forEach((segment) => {
        if (segment.score < 75) {
          correctionsList.push({
            original: segment.text.substring(0, 100) + (segment.text.length > 100 ? '...' : ''),
            suggested: segment.text + ' [Citation needed]',
            reasoning: `Score: ${segment.score}/100 - Add proper citation and verification`,
            confidence: 85,
            type: 'citation-addition'
          });
        }
      });
    }

    // Add citation corrections from evidence
    result.evidence.slice(0, 3).forEach((ev, idx) => {
      correctionsList.push({
        original: 'End of paragraph',
        suggested: `According to ${ev.publisher} (${ev.publishedDate || 'n.d.'}), "${ev.quote.substring(0, 80)}..."`,
        reasoning: `Add citation from high-credibility source (${ev.score}/100)`,
        confidence: ev.score,
        type: 'citation-addition'
      });
    });

    return correctionsList;
  }, [result]);

  const [selectedCorrections, setSelectedCorrections] = useState<string[]>([]);

  const applyCorrection = (correction: Correction) => {
    if (correction.type === 'citation-addition') {
      setEditedContent(prev => prev + '\n\n' + correction.suggested);
    } else {
      setEditedContent(prev => prev.replace(correction.original, correction.suggested));
    }
    setSelectedCorrections([...selectedCorrections, correction.original]);
  };

  const applyAllCorrections = () => {
    let newContent = editedContent;
    corrections.forEach(correction => {
      if (correction.type === 'citation-addition') {
        newContent += '\n\n' + correction.suggested;
      } else {
        newContent = newContent.replace(correction.original, correction.suggested);
      }
    });
    setEditedContent(newContent);
    setSelectedCorrections(corrections.map(c => c.original));
  };

  const exportContent = () => {
    // Create a comprehensive export with citations
    const citations = result.evidence.map((ev, idx) =>
      formatCitation(ev, idx + 1, citationStyle)
    ).join('\n');

    const fullContent = `${editedContent}\n\n---\n\nREFERENCES\n\n${citations}\n\n---\n\nFACT-CHECK VERIFICATION\nScore: ${result.final_score}/100\nVerdict: ${result.final_verdict}\nSources Consulted: ${result.metadata.sources_consulted.total}\nVerification Date: ${new Date().toLocaleDateString()}`;

    const blob = new Blob([fullContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'verified-article.txt';
    a.click();
  };

  const formatCitation = (evidence: EvidenceItem, number: number, style: string): string => {
    const date = evidence.publishedDate || 'n.d.';
    const publisher = evidence.publisher;
    const url = evidence.url || 'URL not available';

    switch (style) {
      case 'apa':
        return `[${number}] ${publisher}. (${date}). Retrieved from ${url}`;
      case 'mla':
        return `[${number}] ${publisher}. "${evidence.quote.substring(0, 50)}..." ${date}. Web. <${url}>`;
      case 'chicago':
        return `[${number}] ${publisher}, "${evidence.quote.substring(0, 50)}...", accessed ${new Date().toLocaleDateString()}, ${url}.`;
      default:
        return `[${number}] ${publisher} - ${url}`;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Editorial Panel</h2>
        <p className="text-gray-600">
          Review and apply suggested corrections based on fact-check analysis and editorial guidelines.
        </p>
      </div>

      {/* Editorial Guidelines Banner */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5">
        <div className="flex items-start space-x-3">
          <BookOpen className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-blue-900 mb-2">Editorial Guidelines Applied</h3>
            <div className="grid grid-cols-3 gap-4 text-sm text-blue-700">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4" />
                <span>AP Style Compliance</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4" />
                <span>Two-Source Verification</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4" />
                <span>Attribution Standards</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Editor Result Summary */}
      {editorResult && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5">
          <div className="flex items-start space-x-3">
            <CheckCircle className="w-6 h-6 text-green-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-green-900 mb-2">
                Auto-Correction Completed ({editorResult.mode})
              </h3>
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-green-700 font-medium">Improvement Score</p>
                  <p className="text-2xl font-bold text-green-800">{editorResult.improvementScore}/100</p>
                </div>
                <div>
                  <p className="text-green-700 font-medium">Changes Applied</p>
                  <p className="text-2xl font-bold text-green-800">{editorResult.changesApplied.length}</p>
                </div>
                <div>
                  <p className="text-green-700 font-medium">Confidence</p>
                  <p className="text-2xl font-bold text-green-800">{editorResult.confidence}%</p>
                </div>
                <div>
                  <p className="text-green-700 font-medium">Processing Time</p>
                  <p className="text-2xl font-bold text-green-800">{(editorResult.processingTime / 1000).toFixed(1)}s</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Corrections Summary */}
      {corrections.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              <h3 className="font-semibold text-yellow-900">
                {corrections.length} Suggested Corrections
              </h3>
            </div>
            <button
              onClick={applyAllCorrections}
              className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm font-medium"
            >
              Apply All
            </button>
          </div>

          <div className="space-y-3 max-h-64 overflow-y-auto">
            {corrections.map((correction, idx) => (
              <div key={idx} className="bg-white border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-xs font-bold text-yellow-700 uppercase px-2 py-1 bg-yellow-100 rounded">
                    {correction.type.replace('-', ' ')}
                  </span>
                  <button
                    onClick={() => applyCorrection(correction)}
                    disabled={selectedCorrections.includes(correction.original)}
                    className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 transition-colors text-xs font-medium disabled:opacity-50"
                  >
                    {selectedCorrections.includes(correction.original) ? 'Applied' : 'Apply'}
                  </button>
                </div>

                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-semibold text-red-700">Original: </span>
                    <span className="text-gray-700 line-through">{correction.original}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-green-700">Suggested: </span>
                    <span className="text-gray-900">{correction.suggested}</span>
                  </div>
                  <p className="text-xs text-gray-600 italic">{correction.reasoning}</p>
                  <div className="flex items-center space-x-2 pt-2 border-t border-gray-100">
                    <span className="text-xs text-gray-500">Confidence:</span>
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden max-w-xs">
                      <div
                        className="h-full bg-green-500"
                        style={{ width: `${correction.confidence}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-gray-700">{correction.confidence}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Editor Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showDiff}
                onChange={(e) => setShowDiff(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Show side-by-side comparison</span>
            </label>

            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Citation Style:</span>
              <select
                value={citationStyle}
                onChange={(e) => setCitationStyle(e.target.value as any)}
                className="px-3 py-1 border border-gray-300 rounded text-sm"
              >
                <option value="apa">APA</option>
                <option value="mla">MLA</option>
                <option value="chicago">Chicago</option>
              </select>
            </div>
          </div>

          <span className="text-sm text-gray-600">
            {editedContent.split(/\s+/).filter(Boolean).length} words
          </span>
        </div>
      </div>

      {/* Editor Area */}
      {showDiff ? (
        <div className="grid grid-cols-2 gap-4">
          {/* Original Content */}
          <div className="border-2 border-gray-300 rounded-lg overflow-hidden">
            <div className="bg-gray-100 px-4 py-2 border-b border-gray-300">
              <h4 className="font-semibold text-gray-700 text-sm">Original</h4>
            </div>
            <div className="p-4 bg-gray-50 h-96 overflow-y-auto">
              <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">
                {originalContent}
              </pre>
            </div>
          </div>

          {/* Edited Content */}
          <div className="border-2 border-blue-500 rounded-lg overflow-hidden">
            <div className="bg-blue-50 px-4 py-2 border-b border-blue-300">
              <h4 className="font-semibold text-blue-700 text-sm">Edited (Track Changes)</h4>
            </div>
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="w-full h-96 p-4 border-0 focus:ring-0 resize-none text-sm"
            />
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            className="w-full h-96 p-4 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all resize-none text-sm"
          />
        </div>
      )}

      {/* Changes Applied Summary */}
      {editorResult && editorResult.changesApplied.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Changes Applied</h3>
          <div className="space-y-3">
            {editorResult.changesApplied.map((change, idx) => (
              <div key={idx} className="p-3 border border-gray-200 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <span className={`text-xs font-bold uppercase px-2 py-1 rounded ${
                    change.type === 'addition' ? 'bg-green-100 text-green-700' :
                    change.type === 'modification' ? 'bg-blue-100 text-blue-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {change.type}
                  </span>
                  <span className="text-xs text-gray-600">
                    Confidence: {Math.round(change.confidence * 100)}%
                  </span>
                </div>
                <p className="text-sm text-gray-700">{change.reason}</p>
                {change.originalPhrase !== change.newPhrase && (
                  <div className="mt-2 text-xs">
                    <p className="text-red-600 line-through">{change.originalPhrase.substring(0, 80)}</p>
                    <p className="text-green-600">{change.newPhrase.substring(0, 80)}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <button
          onClick={() => setEditedContent(originalContent)}
          className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
        >
          Reset to Original
        </button>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              onContentUpdate(editedContent);
              alert('Content updated successfully!');
            }}
            className="px-6 py-2 border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-medium"
          >
            Save Changes
          </button>
          <button
            onClick={exportContent}
            className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:shadow-lg transition-all font-medium flex items-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>Export Verified Article</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SCHEMA PREVIEW MODAL COMPONENT
// ============================================================================

interface SchemaPreviewModalProps {
  schema: string;
  onClose: () => void;
}

function SchemaPreviewModal({ schema, onClose }: SchemaPreviewModalProps) {
  const [copied, setCopied] = useState(false);

  const copySchema = () => {
    navigator.clipboard.writeText(schema);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden">
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4 flex items-center justify-between">
          <h3 className="text-xl font-bold text-white">Schema.org Markup (ClaimReview)</h3>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Copy this JSON-LD schema markup and paste it in your page's &lt;head&gt; section
            </p>
            <button
              onClick={copySchema}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
            <pre className="text-green-400 text-sm font-mono">
              <code>{schema}</code>
            </pre>
          </div>

          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2 flex items-center">
              <Info className="w-4 h-4 mr-2" />
              How to use this schema
            </h4>
            <ul className="text-sm text-blue-700 space-y-2">
              <li className="flex items-start">
                <span className="mr-2">1.</span>
                <span>Copy the JSON-LD markup above</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">2.</span>
                <span>Paste it in your HTML &lt;head&gt; wrapped in: <code className="bg-blue-100 px-1 rounded">&lt;script type="application/ld+json"&gt;...&lt;/script&gt;</code></span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">3.</span>
                <span>Validate using <a href="https://search.google.com/test/rich-results" target="_blank" rel="noopener noreferrer" className="underline">Google's Rich Results Test</a></span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">4.</span>
                <span>Helps with SEO, search result appearance, and fact-check visibility</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">5.</span>
                <span>Provides structured data recognized by search engines for fact-checks</span>
              </li>
            </ul>
          </div>

          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h4 className="font-semibold text-amber-900 mb-2 flex items-center">
              <TrendingUp className="w-4 h-4 mr-2" />
              SEO Benefits
            </h4>
            <ul className="text-sm text-amber-700 space-y-1">
              <li>• Enhanced visibility in search results with fact-check labels</li>
              <li>• Improved credibility and trust signals for your content</li>
              <li>• Eligible for Google's fact-check rich results</li>
              <li>• Better indexing and understanding by search engines</li>
              <li>• Increased click-through rates from fact-check badges</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// REPORT PANEL COMPONENT
// ============================================================================

interface ReportPanelProps {
  result: FactCheckResult;
  onAutoCorrect: (mode: string) => void;
  onShowSchema: () => void;
  isProcessing: boolean;
}

function ReportPanel({ result, onAutoCorrect, onShowSchema, isProcessing }: ReportPanelProps) {
  const getScoreColor = (score: number) => {
    if (score >= 75) return 'text-green-700 bg-green-100 border-green-300';
    if (score >= 50) return 'text-yellow-700 bg-yellow-100 border-yellow-300';
    return 'text-red-700 bg-red-100 border-red-300';
  };

  return (
    <div className="space-y-6">
      {/* Overall Score Card */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Fact-Check Report</h2>
            <p className="text-gray-600 mt-1">Comprehensive verification analysis</p>
          </div>
          <div className={`px-6 py-3 rounded-xl border-2 font-bold text-2xl ${getScoreColor(result.final_score)}`}>
            {result.final_score}/100
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center space-x-2 mb-2">
              <Shield className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-semibold text-blue-900">Verdict</span>
            </div>
            <p className="text-lg font-bold text-blue-700">{result.final_verdict}</p>
          </div>

          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center space-x-2 mb-2">
              <Database className="w-5 h-5 text-green-600" />
              <span className="text-sm font-semibold text-green-900">Sources</span>
            </div>
            <p className="text-lg font-bold text-green-700">{result.evidence.length} verified</p>
          </div>

          <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
            <div className="flex items-center space-x-2 mb-2">
              <Award className="w-5 h-5 text-purple-600" />
              <span className="text-sm font-semibold text-purple-900">Credibility</span>
            </div>
            <p className="text-lg font-bold text-purple-700">
              {result.source_credibility_report?.overallScore || 0}/100
            </p>
          </div>
        </div>

        {result.reasoning && (
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h4 className="font-semibold text-gray-900 mb-2">Analysis Summary</h4>
            <p className="text-gray-700">{result.reasoning}</p>
          </div>
        )}
      </div>

      {/* Metadata Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Verification Metadata</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600 mb-1">Method Used</p>
            <p className="font-semibold text-gray-900">{result.metadata.method_used}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600 mb-1">Processing Time</p>
            <p className="font-semibold text-gray-900">{(result.metadata.processing_time_ms / 1000).toFixed(2)}s</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600 mb-1">APIs Used</p>
            <p className="font-semibold text-gray-900">{result.metadata.apis_used.join(', ')}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600 mb-1">High Credibility Sources</p>
            <p className="font-semibold text-gray-900">
              {result.metadata.sources_consulted.high_credibility} / {result.metadata.sources_consulted.total}
            </p>
          </div>
        </div>
        {result.metadata.warnings.length > 0 && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-semibold text-yellow-900 mb-2">Warnings</h4>
                <ul className="space-y-1">
                  {result.metadata.warnings.map((warning, idx) => (
                    <li key={idx} className="text-sm text-yellow-700">• {warning}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Evidence Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Supporting Evidence ({result.evidence.length})</h3>
        <div className="space-y-4">
          {result.evidence.map((evidence) => (
            <div key={evidence.id} className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-300 transition-all">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center space-x-3">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    evidence.score >= 90 ? 'bg-green-100' : evidence.score >= 70 ? 'bg-yellow-100' : 'bg-orange-100'
                  }`}>
                    <Award className={`w-6 h-6 ${
                      evidence.score >= 90 ? 'text-green-600' : evidence.score >= 70 ? 'text-yellow-600' : 'text-orange-600'
                    }`} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">{evidence.publisher}</h4>
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <span className="font-medium">Reliability: {evidence.score}/100</span>
                      {evidence.credibilityScore && (
                        <>
                          <span>•</span>
                          <span>Credibility: {evidence.credibilityScore}/100</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                {evidence.url && (
                  <a
                    href={evidence.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1 text-sm text-blue-600 hover:text-blue-700 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors flex items-center space-x-1"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>View Source</span>
                  </a>
                )}
              </div>
              <p className="text-gray-700 italic border-l-4 border-gray-300 pl-4">"{evidence.quote}"</p>
              <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                <span className="flex items-center space-x-1">
                  <Calendar className="w-3 h-3" />
                  <span>{evidence.publishedDate || 'Date unknown'}</span>
                </span>
                <span className="px-2 py-0.5 bg-gray-100 rounded">
                  {evidence.type}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Next Steps</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => onAutoCorrect('enhanced')}
            disabled={isProcessing}
            className="p-4 border-2 border-blue-500 text-blue-600 rounded-lg hover:bg-blue-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Edit3 className="w-6 h-6 mx-auto mb-2" />
            <p className="font-semibold">Auto-Correct</p>
            <p className="text-xs text-gray-600 mt-1">Apply fact-check corrections</p>
          </button>

          <button
            onClick={onShowSchema}
            className="p-4 border-2 border-green-500 text-green-600 rounded-lg hover:bg-green-50 transition-all"
          >
            <LinkIcon className="w-6 h-6 mx-auto mb-2" />
            <p className="font-semibold">Generate Schema</p>
            <p className="text-xs text-gray-600 mt-1">SEO-optimized markup</p>
          </button>

          <button
            onClick={() => {
              const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'fact-check-report.json';
              a.click();
            }}
            className="p-4 border-2 border-purple-500 text-purple-600 rounded-lg hover:bg-purple-50 transition-all"
          >
            <Download className="w-6 h-6 mx-auto mb-2" />
            <p className="font-semibold">Export Report</p>
            <p className="text-xs text-gray-600 mt-1">Download as JSON</p>
          </button>
        </div>
      </div>
    </div>
  );
}
