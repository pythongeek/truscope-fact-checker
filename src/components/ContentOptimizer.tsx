import React, { useState } from 'react';
import { SEOOptimizerService } from '../services/seoOptimizer';
import {
  ContentOutline,
  ContentPlan,
  CompetitorAnalysis,
  SEOStrategy
} from '../types/seoAnalysis';
import { FactCheckReport } from '../types/factCheck';

interface ContentOptimizerProps {
  originalContent: string;
  factCheckReport?: FactCheckReport;
  onOptimizedContent: (content: string, plan: ContentPlan) => void;
}

const ContentOptimizer: React.FC<ContentOptimizerProps> = ({
  originalContent,
  factCheckReport,
  onOptimizedContent
}) => {
  const [activeStep, setActiveStep] = useState<'setup' | 'analyze' | 'optimize' | 'review'>('setup');
  const [isProcessing, setIsProcessing] = useState(false);
  const [contentPlan, setContentPlan] = useState<ContentPlan | null>(null);
  const [optimizedContent, setOptimizedContent] = useState<string>('');

  // Form states
  const [topic, setTopic] = useState('');
  const [targetKeywords, setTargetKeywords] = useState('');
  const [competitorUrls, setCompetitorUrls] = useState('');
  const [contentType, setContentType] = useState<'blog-post' | 'guide' | 'tutorial' | 'review' | 'comparison'>('blog-post');
  const [primaryGoal, setPrimaryGoal] = useState<'traffic' | 'conversions' | 'brand-awareness' | 'authority'>('traffic');
  const [targetAudience, setTargetAudience] = useState('');

  const seoService = SEOOptimizerService.getInstance();

  const handleSetupSubmit = () => {
    if (!topic.trim() || !targetKeywords.trim()) {
      alert('Please fill in topic and target keywords');
      return;
    }
    setActiveStep('analyze');
    analyzeContent();
  };

  const analyzeContent = async () => {
    setIsProcessing(true);
    try {
      const keywords = targetKeywords.split(',').map(k => k.trim());
      const urls = competitorUrls.split(',').map(u => u.trim()).filter(u => u);

      // Generate content outline
      const outline: ContentOutline = await seoService.generateContentOutline(topic, keywords);

      // Analyze competitors if URLs provided
      let competitorAnalysis: CompetitorAnalysis | null = null;
      if (urls.length > 0) {
        competitorAnalysis = await seoService.analyzeCompetitorContent(urls);
      }

      // Create comprehensive content plan
      const seoStrategy: SEOStrategy = {
        primaryGoal,
        targetAudience: 'General audience', // Placeholder for a real input field
        contentPillars: keywords.slice(0, 3),
        distributionChannels: ['organic search', 'social media'],
        successMetrics: ['organic traffic', 'engagement rate', 'conversion rate']
      };

      const plan: ContentPlan = {
        topic,
        targetKeywords: keywords,
        contentType,
        outline,
        competitorAnalysis: competitorAnalysis || {
          averageContentLength: 0,
          commonKeywords: [],
          headingPatterns: [],
          contentGaps: [],
          recommendations: []
        },
        seoStrategy
      };

      setContentPlan(plan);
      setActiveStep('optimize');
    } catch (error) {
      console.error('Content analysis failed:', error);
      alert('Failed to analyze content. Please try again.');
      setActiveStep('setup');
    } finally {
      setIsProcessing(false);
    }
  };

  const generateOptimizedContent = async () => {
    if (!contentPlan) return;

    setIsProcessing(true);
    try {
      // Generate optimized content based on the plan
      const optimized = await generateContentFromPlan(contentPlan, originalContent);
      setOptimizedContent(optimized);
      setActiveStep('review');
    } catch (error) {
      console.error('Content optimization failed:', error);
      alert('Failed to optimize content. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const generateContentFromPlan = async (plan: ContentPlan, originalContent: string): Promise<string> => {
    // This would integrate with AI services to generate content
    // For now, we'll create a template-based approach
    let optimizedContent = '';
    // Add optimized title
    optimizedContent += `# ${plan.outline.title}\n\n`;
    // Add meta description as a comment
    optimizedContent += `\n\n`;
    // Add introduction with primary keyword
    optimizedContent += `## Introduction\n\n`;
    optimizedContent += `Welcome to the comprehensive guide on ${plan.topic}. `;
    optimizedContent += `In this article, we'll explore everything you need to know about ${plan.targetKeywords[0]}, `;
    optimizedContent += `including best practices, implementation strategies, and expert insights.\n\n`;
    // Add main sections based on heading structure
    plan.outline.headings.h2Sections.forEach((h2, index) => {
      optimizedContent += `## ${h2}\n\n`;
      // Add subsections if available
      const subsections = plan.outline.headings.h3Subsections[h2];
      if (subsections) {
        subsections.forEach(h3 => {
          optimizedContent += `### ${h3}\n\n`;
          optimizedContent += `Content for ${h3} would go here. This section should cover ${plan.targetKeywords[index % plan.targetKeywords.length]} `;
          optimizedContent += `while maintaining natural language flow and providing valuable insights.\n\n`;
        });
      } else {
        // Add placeholder content for sections without subsections
        optimizedContent += `This section covers important aspects of ${h2.toLowerCase()}. `;
        optimizedContent += `Key points include implementation strategies, best practices, and common challenges.\n\n`;
      }
    });

    // Add FAQ section
    if (plan.outline.faqSection.length > 0) {
      optimizedContent += `## Frequently Asked Questions\n\n`;
      plan.outline.faqSection.forEach(faq => {
        optimizedContent += `### ${faq.question}\n\n`;
        optimizedContent += `${faq.suggestedAnswer}\n\n`;
      });
    }

    // Add conclusion
    optimizedContent += `## Conclusion\n\n`;
    optimizedContent += `In conclusion, ${plan.topic} requires a comprehensive understanding of ${plan.targetKeywords.join(', ')}. `;
    optimizedContent += `By following the strategies outlined in this guide, you'll be well-equipped to achieve your goals.\n\n`;

    return optimizedContent;
  };

  const handleApplyOptimization = () => {
    if (contentPlan && optimizedContent) {
      onOptimizedContent(optimizedContent, contentPlan);
    }
  };

  const renderSetupStep = () => (
    <div className="space-y-6">
      <div className="bg-slate-700/50 p-6 rounded-lg">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">Content Setup</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Topic/Subject
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Content Marketing Strategy"
              className="w-full p-3 bg-slate-800 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Content Type
            </label>
            <select
              value={contentType}
              onChange={(e) => setContentType(e.target.value as any)}
              className="w-full p-3 bg-slate-800 border border-slate-600 rounded-lg text-slate-200"
            >
              <option value="blog-post">Blog Post</option>
              <option value="guide">Comprehensive Guide</option>
              <option value="tutorial">Tutorial</option>
              <option value="review">Review</option>
              <option value="comparison">Comparison</option>
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Target Keywords (comma-separated)
          </label>
          <input
            type="text"
            value={targetKeywords}
            onChange={(e) => setTargetKeywords(e.target.value)}
            placeholder="e.g., content marketing, SEO strategy, digital marketing"
            className="w-full p-3 bg-slate-800 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-400"
          />
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Competitor URLs (optional, comma-separated)
          </label>
          <textarea
            value={competitorUrls}
            onChange={(e) => setCompetitorUrls(e.target.value)}
            placeholder="e.g., https://competitor1.com/article, https://competitor2.com/guide"
            rows={3}
            className="w-full p-3 bg-slate-800 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-400 resize-none"
          />
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Primary Goal
          </label>
          <select
            value={primaryGoal}
            onChange={(e) => setPrimaryGoal(e.target.value as any)}
            className="w-full p-3 bg-slate-800 border border-slate-600 rounded-lg text-slate-200"
          >
            <option value="traffic">Increase Organic Traffic</option>
            <option value="conversions">Drive Conversions</option>
            <option value="brand-awareness">Build Brand Awareness</option>
            <option value="authority">Establish Authority</option>
          </select>
        </div>

        <button
          onClick={handleSetupSubmit}
          className="mt-6 w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          Analyze & Create Plan
        </button>
      </div>
    </div>
  );

  const renderAnalyzeStep = () => (
    <div className="space-y-6">
      {isProcessing ? (
        <div className="bg-slate-700/50 p-8 rounded-lg text-center">
          <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <h3 className="text-lg font-semibold text-slate-100">Analyzing Content Strategy...</h3>
          <p className="text-slate-300">Creating comprehensive content plan and competitor analysis</p>
        </div>
      ) : contentPlan ? (
        <div className="space-y-4">
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-green-400">✅</span>
              <h3 className="font-semibold text-green-300">Analysis Complete</h3>
            </div>
            <p className="text-green-400 text-sm">
              Content plan generated successfully. Ready to optimize your content.
            </p>
          </div>

          <button
            onClick={generateOptimizedContent}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Generate Optimized Content
          </button>
        </div>
      ) : null}
    </div>
  );

  const renderOptimizeStep = () => (
    <div className="space-y-6">
      {isProcessing ? (
        <div className="bg-slate-700/50 p-8 rounded-lg text-center">
          <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <h3 className="text-lg font-semibold text-slate-100">Optimizing Content...</h3>
          <p className="text-slate-300">Generating SEO-optimized content based on your strategy</p>
        </div>
      ) : (
        <div className="bg-slate-700/50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">Content Optimization</h3>
          <div className="text-center">
            <div className="text-4xl mb-4">🚀</div>
            <h4 className="text-xl font-semibold text-slate-100 mb-2">Ready to Optimize!</h4>
            <p className="text-slate-300 mb-4">
              Click below to generate your SEO-optimized content based on the comprehensive analysis.
            </p>
            <button
              onClick={generateOptimizedContent}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              Generate Optimized Content
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderReviewStep = () => (
    <div className="space-y-6">
      {/* Content Plan Overview */}
      {contentPlan && (
        <div className="bg-slate-700/50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">Content Plan Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-slate-200 mb-2">SEO Strategy</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Title:</span>
                  <span className="text-slate-200">{contentPlan.outline.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Content Type:</span>
                  <span className="text-slate-200 capitalize">{contentPlan.contentType.replace('-', ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Primary Goal:</span>
                  <span className="text-slate-200 capitalize">{contentPlan.seoStrategy.primaryGoal.replace('-', ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Target Length:</span>
                  <span className="text-slate-200">{contentPlan.outline.contentLength.optimalWords} words</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-slate-200 mb-2">Keywords</h4>
              <div className="flex flex-wrap gap-1">
                {contentPlan.targetKeywords.map((keyword, index) => (
                  <span
                    key={index}
                    className={`px-2 py-1 rounded text-xs ${
                      index === 0
                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                        : 'bg-slate-600/50 text-slate-300'
                    }`}
                  >
                    {keyword} {index === 0 && '(Primary)'}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Generated Content Preview */}
      <div className="bg-slate-700/50 p-6 rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-100">Optimized Content</h3>
          <div className="flex gap-2">
            <button
              onClick={() => navigator.clipboard.writeText(optimizedContent)}
              className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-slate-200 rounded transition-colors"
            >
              Copy Content
            </button>
            <button
              onClick={handleApplyOptimization}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors"
            >
              Apply Optimization
            </button>
          </div>
        </div>

        <div className="bg-slate-900/50 p-4 rounded border border-slate-600 max-h-96 overflow-y-auto">
          <pre className="whitespace-pre-wrap text-slate-300 text-sm leading-relaxed">
            {optimizedContent}
          </pre>
        </div>
      </div>

      {/* FAQ Preview */}
      {contentPlan && contentPlan.outline.faqSection.length > 0 && (
        <div className="bg-slate-700/50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">FAQ Section Preview</h3>
          <div className="space-y-4">
            {contentPlan.outline.faqSection.slice(0, 3).map((faq, index) => (
              <div key={index} className="p-4 bg-slate-800/50 rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-slate-200 mb-2">{faq.question}</h4>
                    <p className="text-slate-400 text-sm line-clamp-2">{faq.suggestedAnswer}</p>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-sm text-slate-400">Volume</div>
                    <div className="font-semibold text-slate-200">{faq.searchVolume.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Competitor Insights */}
      {contentPlan && contentPlan.competitorAnalysis.recommendations.length > 0 && (
        <div className="bg-slate-700/50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">Competitive Advantages</h3>
          <div className="space-y-2">
            {contentPlan.competitorAnalysis.recommendations.map((recommendation, index) => (
              <div key={index} className="flex items-start gap-2">
                <span className="text-green-400 mt-0.5">•</span>
                <span className="text-slate-300 text-sm">{recommendation}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-slate-800/50 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-6 bg-slate-900/50 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-100">Content Optimizer</h2>
            <p className="text-slate-300">AI-powered content strategy and optimization</p>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center space-x-2">
            {(['setup', 'analyze', 'optimize', 'review'] as const).map((step, index) => (
              <div key={step} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  activeStep === step
                    ? 'bg-indigo-600 text-white'
                    : index < (['setup', 'analyze', 'optimize', 'review'] as const).indexOf(activeStep)
                    ? 'bg-green-600 text-white'
                    : 'bg-slate-600 text-slate-300'
                }`}>
                  {index + 1}
                </div>
                {index < 3 && (
                  <div className={`w-8 h-0.5 ${
                    index < (['setup', 'analyze', 'optimize', 'review'] as const).indexOf(activeStep)
                      ? 'bg-green-600'
                      : 'bg-slate-600'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeStep === 'setup' && renderSetupStep()}
        {activeStep === 'analyze' && renderAnalyzeStep()}
        {activeStep === 'optimize' && renderOptimizeStep()}
        {activeStep === 'review' && renderReviewStep()}
      </div>
    </div>
  );
};

export default ContentOptimizer;
