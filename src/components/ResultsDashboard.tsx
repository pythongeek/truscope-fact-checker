import React, { useState } from 'react';
import type { AnalysisResult, ActiveTab, Claim, RichSource } from '../types';
import { ScoreCard } from './ScoreCard';
import { TabButton } from './TabButton';
import { 
    CheckCircleIcon, AlertTriangleIcon, SearchIcon, InfoIcon, XCircleIcon, 
    BookOpenIcon, EditIcon, BarChartIcon, LinkIcon, UsersIcon, GitBranchIcon, 
    UserIcon, AlertOctagonIcon, BrainCircuitIcon, ScaleIcon, MegaphoneIcon,
    CodeIcon, CopyIcon, CheckIcon, QuoteIcon
} from './Icons';

const getStatusInfo = (status: Claim['status']) => {
    // Normalize status for consistent matching
    const lowerStatus = status.toLowerCase();
    if (lowerStatus.includes('verified')) return { Icon: CheckCircleIcon, color: 'text-green-600', bgColor: 'bg-green-50' };
    if (lowerStatus.includes('needs verification') || lowerStatus.includes('unverified')) return { Icon: SearchIcon, color: 'text-yellow-600', bgColor: 'bg-yellow-50' };
    if (lowerStatus.includes('misleading')) return { Icon: AlertTriangleIcon, color: 'text-orange-600', bgColor: 'bg-orange-50' };
    if (lowerStatus.includes('false')) return { Icon: XCircleIcon, color: 'text-red-600', bgColor: 'bg-red-50' };
    if (lowerStatus.includes('opinion')) return { Icon: InfoIcon, color: 'text-blue-600', bgColor: 'bg-blue-50' };
    return { Icon: InfoIcon, color: 'text-gray-500', bgColor: 'bg-gray-50' };
};

const getConsensusInfo = (consensus: Claim['consensus_status']) => {
    switch(consensus) {
        case 'High Consensus': return { Icon: UsersIcon, color: 'text-green-600', text: 'High Consensus'};
        case 'Conflicting Reports': return { Icon: GitBranchIcon, color: 'text-orange-600', text: 'Conflicting Reports'};
        case 'Single Source': return { Icon: UserIcon, color: 'text-yellow-600', text: 'Single Source'};
        case 'No Sources Found': return { Icon: XCircleIcon, color: 'text-gray-500', text: 'No Sources Found'};
        default: return { Icon: InfoIcon, color: 'text-gray-500', text: 'Unknown'};
    }
};

const AnomalyBadge = () => (
    <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-red-700 bg-red-100 border border-red-200 rounded-full">
        <AlertOctagonIcon className="w-4 h-4" />
        <span>Anomaly Detected</span>
    </div>
);

const ConsensusBadge: React.FC<{consensus: Claim['consensus_status']}> = ({ consensus }) => {
    const { Icon, color, text } = getConsensusInfo(consensus);
    return (
        <div className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium ${color.replace('text', 'bg').replace('-600', '-100')} ${color} border ${color.replace('text', 'border').replace('-600', '-200')} rounded-full`}>
            <Icon className="w-4 h-4" />
            <span>{text}</span>
        </div>
    );
};

const getCredibilityColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
};

const getBiasColor = (bias: RichSource['bias_rating']) => {
    const lowerBias = bias.toLowerCase();
    if (lowerBias.includes('left')) return 'bg-blue-100 text-blue-800';
    if (lowerBias.includes('right')) return 'bg-red-100 text-red-800';
    if (lowerBias.includes('corporate')) return 'bg-indigo-100 text-indigo-800';
    if (lowerBias.includes('center')) return 'bg-gray-100 text-gray-800';
    return 'bg-purple-100 text-purple-800';
}

const SourceCard: React.FC<{source: RichSource}> = ({ source }) => (
    <div className="border rounded-lg p-3 bg-white hover:shadow-md transition-shadow duration-200">
        <a href={source.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-sm text-blue-700 hover:underline break-words">
            {source.title}
        </a>
        <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
            <span className={`px-2 py-0.5 font-medium rounded-full ${getBiasColor(source.bias_rating)}`}>{source.bias_rating}</span>
            <span className="px-2 py-0.5 font-medium rounded-full bg-gray-100 text-gray-800">{source.source_type}</span>
        </div>
        <div className="mt-3">
            <p className="text-xs text-gray-600 font-medium mb-1">Credibility: {source.credibility_score}%</p>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div className={`${getCredibilityColor(source.credibility_score)} h-1.5 rounded-full`} style={{width: `${source.credibility_score}%`}}></div>
            </div>
        </div>
    </div>
);


const OverviewTab: React.FC<{ result: AnalysisResult }> = ({ result }) => (
    <div className="space-y-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-xl font-bold text-gray-800 mb-3">Analysis Summary</h3>
            <p className="text-gray-600 leading-relaxed">{result.overall_summary}</p>
        </div>
        {result.misinformation_alerts.length > 0 && (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <AlertTriangleIcon className="text-yellow-500 w-6 h-6" />
                    Misinformation Alerts
                </h3>
                <ul className="space-y-4">
                    {result.misinformation_alerts.map((alert, index) => (
                        <li key={index} className="p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-md">
                            <p className="font-semibold text-yellow-800">{alert.type}</p>
                            <p className="text-yellow-700 italic my-1">"{alert.text}"</p>
                            <p className="text-sm text-yellow-900">{alert.explanation}</p>
                        </li>
                    ))}
                </ul>
            </div>
        )}
        {result.grounding_sources.length > 0 && (
             <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <LinkIcon className="text-blue-500 w-6 h-6" />
                    Key Sources Found by Google Search
                </h3>
                <ul className="space-y-3">
                    {result.grounding_sources.slice(0, 5).map((source, index) => (
                         <li key={index} className="text-sm">
                             <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline hover:text-blue-800 transition-colors break-all">
                                 {source.title}
                             </a>
                         </li>
                    ))}
                </ul>
            </div>
        )}
    </div>
);

const ClaimsTab: React.FC<{ result: AnalysisResult }> = ({ result }) => (
    <div className="space-y-4">
        {result.claims.map((claim, index) => {
            const { Icon, color, bgColor } = getStatusInfo(claim.status);
            return (
                <div key={index} className={`p-5 rounded-lg border shadow-sm ${bgColor}`}>
                    <div className="flex items-center gap-3">
                        <Icon className={`${color} w-6 h-6 flex-shrink-0`} />
                        <h4 className={`text-lg font-bold ${color}`}>{claim.status}</h4>
                        <span className="text-sm font-medium text-gray-500">(Confidence: {claim.confidence}%)</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 my-3">
                        <ConsensusBadge consensus={claim.consensus_status} />
                        {claim.is_anomaly && <AnomalyBadge />}
                    </div>
                    <blockquote className="relative border-l-4 border-gray-300 pl-8 py-1 text-gray-700 italic my-4">
                        <QuoteIcon className="absolute -left-1 top-0 w-5 h-5 text-gray-300" />
                        "{claim.claim_text}"
                    </blockquote>
                    <p className="text-sm text-gray-600 mb-4">{claim.explanation}</p>
                    
                    {claim.sources.length > 0 && (
                        <div>
                            <h5 className="text-sm font-semibold text-gray-800 mb-2">Cited Sources for this Claim:</h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {claim.sources.map((source, s_index) => (
                                    <SourceCard key={s_index} source={source} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )
        })}
    </div>
);

const EnhancedArticleTab: React.FC<{ result: AnalysisResult }> = ({ result }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        if (result.claim_review_json_ld) {
            navigator.clipboard.writeText(result.claim_review_json_ld);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    let formattedJsonLd = result.claim_review_json_ld;
    try {
        if (result.claim_review_json_ld) {
           formattedJsonLd = JSON.stringify(JSON.parse(result.claim_review_json_ld), null, 2);
        }
    } catch (e) {
        // Ignore parsing errors, just display raw string
    }

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-xl font-bold text-gray-800 mb-3">Enhanced Article with Inline Citations</h3>
                <div
                    className="prose prose-lg max-w-none font-serif leading-relaxed enhanced-article-content"
                    dangerouslySetInnerHTML={{ __html: result.enhanced_article_html }}
                />
            </div>

            {result.claim_review_json_ld && result.claim_review_json_ld !== "{}" && (
                 <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h3 className="text-xl font-bold text-gray-800 mb-3 flex items-center gap-2">
                        <CodeIcon className="w-6 h-6 text-gray-500" />
                        Fact-Check Schema (JSON-LD)
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
                        This structured data helps search engines understand the fact-check information. You can embed this in your page's HTML.
                    </p>
                    <div className="relative bg-gray-900 text-white rounded-lg p-4 font-mono text-xs overflow-x-auto">
                        <button
                            onClick={handleCopy}
                            className="absolute top-2 right-2 p-2 bg-gray-700 hover:bg-gray-600 rounded-md transition-all text-gray-300"
                            aria-label="Copy JSON-LD to clipboard"
                            title={copied ? "Copied!" : "Copy JSON-LD"}
                        >
                            {copied ? <CheckIcon className="w-4 h-4 text-green-400" /> : <CopyIcon className="w-4 h-4" />}
                        </button>
                        <pre><code>{formattedJsonLd}</code></pre>
                    </div>
                </div>
            )}

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-xl font-bold text-gray-800 mb-3">Editorial Suggestions</h3>
                <ul className="space-y-2 list-disc list-inside text-gray-700">
                    {result.editorial_suggestions.map((suggestion, index) => (
                        <li key={index}>{suggestion}</li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

const NewsStandardsTab: React.FC<{ result: AnalysisResult }> = ({ result }) => {
    const standardsData = [
        { name: 'Your Article', scores: result.news_standards_analysis, isCurrent: true },
        { name: 'Reuters', scores: { accuracy: 90, sourcing: 85, neutrality: 85, depth: 80 } },
        { name: 'Associated Press', scores: { accuracy: 92, sourcing: 88, neutrality: 90, depth: 75 } },
        { name: 'New York Times', scores: { accuracy: 88, sourcing: 85, neutrality: 70, depth: 90 } },
        { name: 'CNN', scores: { accuracy: 75, sourcing: 70, neutrality: 60, depth: 70 } },
    ];

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-xl font-bold text-gray-800 mb-4">News Standards Comparison</h3>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Publication</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Accuracy</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Sourcing</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Neutrality</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Depth</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {standardsData.map((item, index) => (
                            <tr key={index} className={item.isCurrent ? 'bg-blue-50' : ''}>
                                <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${item.isCurrent ? 'text-blue-900' : 'text-gray-900'}`}>{item.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">{item.scores.accuracy}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">{item.scores.sourcing}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">{item.scores.neutrality}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">{item.scores.depth}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const DeepAnalysisTab: React.FC<{ result: AnalysisResult }> = ({ result }) => {
    const { logical_fallacies, propaganda_techniques } = result.deep_analysis;

    if (logical_fallacies.length === 0 && propaganda_techniques.length === 0) {
        return (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 text-center">
                <BrainCircuitIcon className="w-12 h-12 mx-auto text-gray-400" />
                <h3 className="mt-2 text-lg font-medium text-gray-900">No specific rhetorical devices detected.</h3>
                <p className="mt-1 text-sm text-gray-500">The article appears to be straightforward in its presentation.</p>
            </div>
        )
    }

    return (
        <div className="space-y-8">
            {logical_fallacies.length > 0 && (
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <ScaleIcon className="text-purple-600 w-6 h-6" />
                        Logical Fallacies Detected
                    </h3>
                    <div className="space-y-4">
                        {logical_fallacies.map((fallacy, index) => (
                            <div key={index} className="p-4 bg-purple-50 border-l-4 border-purple-400 rounded-r-md">
                                <p className="font-semibold text-purple-800">{fallacy.name}</p>
                                <blockquote className="relative text-purple-700 italic my-2 pl-6">
                                    <QuoteIcon className="absolute left-0 top-0 w-4 h-4 text-purple-300" />
                                    "{fallacy.text}"
                                </blockquote>
                                <p className="text-sm text-purple-900">{fallacy.explanation}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {propaganda_techniques.length > 0 && (
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <MegaphoneIcon className="text-teal-600 w-6 h-6" />
                        Propaganda Techniques Detected
                    </h3>
                    <div className="space-y-4">
                        {propaganda_techniques.map((technique, index) => (
                             <div key={index} className="p-4 bg-teal-50 border-l-4 border-teal-400 rounded-r-md">
                                <p className="font-semibold text-teal-800">{technique.name}</p>
                                <blockquote className="relative text-teal-700 italic my-2 pl-6">
                                    <QuoteIcon className="absolute left-0 top-0 w-4 h-4 text-teal-300" />
                                    "{technique.text}"
                                </blockquote>
                                <p className="text-sm text-teal-900">{technique.explanation}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};


export const ResultsDashboard: React.FC<{ result: AnalysisResult }> = ({ result }) => {
    const [activeTab, setActiveTab] = useState<ActiveTab>('overview');

    const renderTabContent = () => {
        switch (activeTab) {
            case 'overview': return <OverviewTab result={result} />;
            case 'claims': return <ClaimsTab result={result} />;
            case 'enhanced': return <EnhancedArticleTab result={result} />;
            case 'standards': return <NewsStandardsTab result={result} />;
            case 'deep_analysis': return <DeepAnalysisTab result={result} />;
            default: return null;
        }
    };

    return (
        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg border border-gray-200">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-6">2. Analysis Results</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <ScoreCard label="Factual Accuracy" score={result.factual_accuracy_score} description="Based on verifiable claims and source reliability" />
                <ScoreCard label="Misinformation Risk" score={result.misinformation_risk} description="Likelihood of containing false or misleading information" isRisk />
                <ScoreCard label="News Standard Score" score={result.news_standards_score} description="Compared to major journalistic publications" />
            </div>

            <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex space-x-2 sm:space-x-6 overflow-x-auto" aria-label="Tabs">
                    <TabButton label="Overview" Icon={BookOpenIcon} isActive={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
                    <TabButton label="Claims Analysis" Icon={SearchIcon} isActive={activeTab === 'claims'} onClick={() => setActiveTab('claims')} />
                    <TabButton label="Deep Analysis" Icon={BrainCircuitIcon} isActive={activeTab === 'deep_analysis'} onClick={() => setActiveTab('deep_analysis')} />
                    <TabButton label="Enhanced Article" Icon={EditIcon} isActive={activeTab === 'enhanced'} onClick={() => setActiveTab('enhanced')} />
                    <TabButton label="News Standards" Icon={BarChartIcon} isActive={activeTab === 'standards'} onClick={() => setActiveTab('standards')} />
                </nav>
            </div>

            <div key={activeTab} className="animate-entry fade-in">{renderTabContent()}</div>
        </div>
    );
};
