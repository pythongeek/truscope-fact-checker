import React, { useState } from 'react';
import { Segment } from '../types/factCheck';

interface EnhancedColorCodedTextProps {
    segments: Segment[] | undefined;
    originalText: string;
    onOpenEditor?: () => void;
}

const EnhancedColorCodedText: React.FC<EnhancedColorCodedTextProps> = ({
    segments,
    originalText,
    onOpenEditor
}) => {
    const [selectedSegment, setSelectedSegment] = useState<number | null>(null);

    const getColorClass = (color: Segment['color']) => {
        switch (color) {
            case 'green':
                return 'bg-green-500/20 text-green-200 border-green-500/30 hover:bg-green-500/30';
            case 'yellow':
                return 'bg-yellow-500/20 text-yellow-200 border-yellow-500/30 hover:bg-yellow-500/30';
            case 'red':
                return 'bg-red-500/20 text-red-200 border-red-500/30 hover:bg-red-500/30';
            default:
                return 'text-slate-300 border-slate-600/30 hover:bg-slate-700/30';
        }
    };

    const getScoreLabel = (score: number) => {
        if (score >= 75) return 'High Confidence';
        if (score >= 40) return 'Medium Confidence';
        return 'Low Confidence';
    };

    const getScoreIcon = (score: number) => {
        if (score >= 75) {
            return (
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
            );
        }
        if (score >= 40) {
            return (
                <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
            );
        }
        return (
            <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
        );
    };

    if (!segments || segments.length === 0) {
        return (
            <div className="bg-slate-800/50 p-6 rounded-2xl text-center space-y-3">
                <div className="text-slate-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-300">No Text Analysis Available</h3>
                <p className="text-slate-400 max-w-md mx-auto">
                    Text analysis with color-coding is only available with enhanced analysis methods.
                </p>
            </div>
        );
    }

    return (
        <div className="bg-slate-800/50 p-6 rounded-2xl space-y-6">
            {/* Header Section */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-slate-100 mb-2">Original Text Analysis</h3>
                    <p className="text-sm text-slate-300">
                        Click on any segment to see detailed analysis. Color-coding shows factual confidence.
                    </p>
                </div>
                {onOpenEditor && (
                    <button
                        onClick={onOpenEditor}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Auto Editor
                    </button>
                )}
            </div>

            {/* Color Legend */}
            <div className="flex flex-wrap gap-4 p-4 bg-slate-900/50 rounded-lg">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-xs text-slate-300">High Confidence (75-100)</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <span className="text-xs text-slate-300">Medium Confidence (40-74)</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span className="text-xs text-slate-300">Low Confidence (0-39)</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-slate-500 rounded-full"></div>
                    <span className="text-xs text-slate-300">Neutral Content</span>
                </div>
            </div>

            {/* Interactive Text Segments */}
            <div className="bg-slate-900/50 p-6 rounded-lg">
                <h4 className="text-sm font-semibold text-slate-300 mb-4">Interactive Text Analysis</h4>
                <div className="space-y-2">
                    {segments.map((segment, index) => (
                        <div
                            key={index}
                            onClick={() => setSelectedSegment(selectedSegment === index ? null : index)}
                            className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 ${getColorClass(segment.color)} ${
                                selectedSegment === index ? 'ring-2 ring-indigo-400 shadow-lg' : ''
                            }`}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <p className="text-base leading-relaxed flex-1 select-text">
                                    {segment.text}
                                </p>
                                <div className="flex-shrink-0 flex items-center gap-2">
                                    {getScoreIcon(segment.score)}
                                    <div className="text-right">
                                        <div className="text-sm font-semibold">
                                            {segment.score}/100
                                        </div>
                                        <div className="text-xs opacity-75">
                                            {getScoreLabel(segment.score)}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Expanded details */}
                            {selectedSegment === index && (
                                <div className="mt-3 pt-3 border-t border-slate-600/50">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <h5 className="font-semibold text-slate-200 mb-1">Analysis Details</h5>
                                            <ul className="space-y-1 text-slate-300">
                                                <li>• Confidence Score: {segment.score}/100</li>
                                                <li>• Classification: {getScoreLabel(segment.score)}</li>
                                                <li>• Segment Length: {segment.text.length} characters</li>
                                                <li>• Position: Segment {index + 1} of {segments.length}</li>
                                            </ul>
                                        </div>
                                        <div>
                                            <h5 className="font-semibold text-slate-200 mb-1">Recommendations</h5>
                                            <ul className="space-y-1 text-slate-300">
                                                {segment.score < 40 ? (
                                                    <>
                                                        <li>• Requires fact-checking</li>
                                                        <li>• Consider removing or revising</li>
                                                        <li>• Verify with reliable sources</li>
                                                    </>
                                                ) : segment.score < 75 ? (
                                                    <>
                                                        <li>• Add context or sources</li>
                                                        <li>• Clarify ambiguous statements</li>
                                                        <li>• Consider qualifying language</li>
                                                    </>
                                                ) : (
                                                    <>
                                                        <li>• Content appears reliable</li>
                                                        <li>• Well-supported claim</li>
                                                        <li>• No major revisions needed</li>
                                                    </>
                                                )}
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Analysis Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-900/50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-400">
                        {segments.filter(s => s.score >= 75).length}
                    </div>
                    <div className="text-xs text-slate-400">High Confidence</div>
                </div>
                <div className="bg-slate-900/50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-yellow-400">
                        {segments.filter(s => s.score >= 40 && s.score < 75).length}
                    </div>
                    <div className="text-xs text-slate-400">Medium Confidence</div>
                </div>
                <div className="bg-slate-900/50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-red-400">
                        {segments.filter(s => s.score < 40).length}
                    </div>
                    <div className="text-xs text-slate-400">Low Confidence</div>
                </div>
                <div className="bg-slate-900/50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-slate-400">
                        {Math.round(segments.reduce((sum, s) => sum + s.score, 0) / segments.length)}
                    </div>
                    <div className="text-xs text-slate-400">Overall Score</div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-3 pt-4 border-t border-slate-700/50">
                <button
                    onClick={() => {
                        const analysisData = {
                            segments,
                            summary: {
                                high: segments.filter(s => s.score >= 75).length,
                                medium: segments.filter(s => s.score >= 40 && s.score < 75).length,
                                low: segments.filter(s => s.score < 40).length,
                                overall: Math.round(segments.reduce((sum, s) => sum + s.score, 0) / segments.length)
                            }
                        };

                        const dataStr = JSON.stringify(analysisData, null, 2);
                        const blob = new Blob([dataStr], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `text_analysis_${new Date().toISOString().slice(0, 19)}.json`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                    }}
                    className="px-4 py-2 bg-slate-700/50 hover:bg-slate-600/50 text-slate-200 text-sm rounded-lg transition-colors"
                >
                    Export Analysis
                </button>
                <button
                    onClick={() => {
                        if (navigator.share) {
                            navigator.share({
                                title: 'Text Analysis Results',
                                text: `Text analysis complete: ${segments.length} segments analyzed`,
                            });
                        } else {
                            navigator.clipboard.writeText(window.location.href);
                            alert('Analysis URL copied to clipboard!');
                        }
                    }}
                    className="px-4 py-2 bg-slate-700/50 hover:bg-slate-600/50 text-slate-200 text-sm rounded-lg transition-colors"
                >
                    Share Results
                </button>
                <button
                    onClick={() => {
                        const report = `# Text Analysis Report\n\nGenerated: ${new Date().toLocaleString()}\n\n## Summary\n- Total Segments: ${segments.length}\n- High Confidence: ${segments.filter(s => s.score >= 75).length}\n- Medium Confidence: ${segments.filter(s => s.score >= 40 && s.score < 75).length}\n- Low Confidence: ${segments.filter(s => s.score < 40).length}\n- Overall Score: ${Math.round(segments.reduce((sum, s) => sum + s.score, 0) / segments.length)}/100\n\n## Detailed Analysis\n\n${segments.map((segment, index) => `### Segment ${index + 1} (Score: ${segment.score}/100)\n${segment.text}\n`).join('\n')}`;

                        const blob = new Blob([report], { type: 'text/markdown' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `text_analysis_report_${new Date().toISOString().slice(0, 19)}.md`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                    }}
                    className="px-4 py-2 bg-slate-700/50 hover:bg-slate-600/50 text-slate-200 text-sm rounded-lg transition-colors"
                >
                    Generate Report
                </button>
            </div>
        </div>
    );
};

export default EnhancedColorCodedText;
