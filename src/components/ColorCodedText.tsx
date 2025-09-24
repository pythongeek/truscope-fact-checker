import React from 'react';
import { TextSegment as Segment } from '../types';

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
                    Text analysis with color-coding is only available with the Citation-Augmented Analysis method.
                </p>
            </div>
        );
    }

    const getColorClass = (color: Segment['color']) => {
        switch (color) {
            case 'green':
                return 'bg-green-500/20 text-green-200 border-green-500/30';
            case 'yellow':
                return 'bg-yellow-500/20 text-yellow-200 border-yellow-500/30';
            case 'red':
                return 'bg-red-500/20 text-red-200 border-red-500/30';
            default:
                return 'text-slate-300 border-slate-600/30';
        }
    };

    const getScoreLabel = (score: number) => {
        if (score >= 75) return 'High Confidence';
        if (score >= 40) return 'Medium Confidence';
        return 'Low Confidence';
    };

    return (
        <div className="bg-slate-800/50 p-6 rounded-2xl space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-slate-100 mb-2">Original Text Analysis</h3>
                <p className="text-sm text-slate-300">
                    Each segment of your original text is analyzed and color-coded based on factual confidence.
                </p>
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
            </div>

            {/* Analyzed Text */}
            <div className="bg-slate-900/50 p-6 rounded-lg">
                <h4 className="text-sm font-semibold text-slate-300 mb-4">Analyzed Text Segments</h4>
                <div className="space-y-3">
                    {segments.map((segment, index) => (
                        <div key={index} className={`p-3 rounded-lg border transition-colors ${getColorClass(segment.color)}`}>
                            <div className="flex items-start justify-between gap-3 mb-2">
                                <p className="text-base leading-relaxed flex-1">
                                    {segment.text}
                                </p>
                                <div className="flex-shrink-0 text-right">
                                    <div className="text-sm font-semibold">
                                        {segment.score}/100
                                    </div>
                                    <div className="text-xs opacity-75">
                                        {getScoreLabel(segment.score)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Analysis Summary */}
            <div className="bg-slate-900/50 p-4 rounded-lg">
                <h4 className="text-sm font-semibold text-slate-300 mb-2">Analysis Summary</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                    <div>
                        <div className="text-lg font-bold text-green-400">
                            {segments.filter(s => s.score >= 75).length}
                        </div>
                        <div className="text-xs text-slate-400">High Confidence Segments</div>
                    </div>
                    <div>
                        <div className="text-lg font-bold text-yellow-400">
                            {segments.filter(s => s.score >= 40 && s.score < 75).length}
                        </div>
                        <div className="text-xs text-slate-400">Medium Confidence Segments</div>
                    </div>
                    <div>
                        <div className="text-lg font-bold text-red-400">
                            {segments.filter(s => s.score < 40).length}
                        </div>
                        <div className="text-xs text-slate-400">Low Confidence Segments</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ColorCodedText;
