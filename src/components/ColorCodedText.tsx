import React from 'react';
import { Segment } from '@/types';

interface ColorCodedTextProps {
    segments: Segment[] | undefined;
}

const ColorCodedText: React.FC<ColorCodedTextProps> = ({ segments }) => {
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
                    A detailed text analysis will appear here once a fact-check is complete.
                </p>
            </div>
        );
    }

    const getColorClass = (confidence: number | undefined) => {
        if (confidence === undefined) return 'text-slate-300 border-slate-600/30';
        if (confidence >= 75) return 'bg-green-500/20 text-green-200 border-green-500/30';
        if (confidence >= 40) return 'bg-yellow-500/20 text-yellow-200 border-yellow-500/30';
        return 'bg-red-500/20 text-red-200 border-red-500/30';
    };

    const getScoreLabel = (confidence: number | undefined) => {
        if (confidence === undefined) return 'Not a fact';
        if (confidence >= 75) return 'High Confidence';
        if (confidence >= 40) return 'Medium Confidence';
        return 'Low Confidence';
    };

    const factSegments = segments.filter(s => s.isFact && s.factCheckResult);
    const totalScore = factSegments.reduce((acc, s) => acc + (s.factCheckResult?.confidence || 0), 0);
    const averageScore = factSegments.length > 0 ? Math.round(totalScore / factSegments.length) : 0;

    return (
        <div className="bg-slate-800/50 p-6 rounded-2xl space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-slate-100 mb-2">Original Text Analysis</h3>
                <p className="text-sm text-slate-300">
                    Each segment of your original text is analyzed and color-coded based on factual confidence.
                </p>
            </div>

            <div className="flex flex-wrap gap-4 p-4 bg-slate-900/50 rounded-lg">
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-500 rounded-full"></div><span className="text-xs text-slate-300">High Confidence</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-yellow-500 rounded-full"></div><span className="text-xs text-slate-300">Medium Confidence</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500 rounded-full"></div><span className="text-xs text-slate-300">Low Confidence</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-slate-500 rounded-full"></div><span className="text-xs text-slate-300">Opinion/Non-Factual</span></div>
            </div>

            <div className="bg-slate-900/50 p-6 rounded-lg">
                <h4 className="text-sm font-semibold text-slate-300 mb-4">Analyzed Text Segments</h4>
                <div className="space-y-3">
                    {segments.map((segment, index) => {
                        const confidence = segment.factCheckResult?.confidence;
                        return (
                            <div key={index} className={`p-3 rounded-lg border transition-colors ${getColorClass(confidence)}`}>
                                <div className="flex items-start justify-between gap-3">
                                    <p className="text-base leading-relaxed flex-1">{segment.text}</p>
                                    {segment.isFact && confidence !== undefined && (
                                        <div className="flex-shrink-0 text-right">
                                            <div className="text-sm font-semibold">{confidence}/100</div>
                                            <div className="text-xs opacity-75">{getScoreLabel(confidence)}</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="bg-slate-900/50 p-4 rounded-lg">
                <h4 className="text-sm font-semibold text-slate-300 mb-2">Analysis Summary</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-center">
                    <div>
                        <div className="text-lg font-bold text-slate-100">{averageScore}<span className="text-sm">%</span></div>
                        <div className="text-xs text-slate-400">Average Confidence</div>
                    </div>
                    <div>
                        <div className="text-lg font-bold text-slate-100">{factSegments.length}</div>
                        <div className="text-xs text-slate-400">Factual Claims Identified</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ColorCodedText;
