import React from 'react';
// FIX: Corrected import path for types and aliased ScoreBreakdown to avoid naming conflict.
import { ScoreBreakdown as ScoreBreakdownType, ScoreMetric } from '@/types/factCheck';
import { LightBulbIcon } from './icons';

const MetricBar: React.FC<{ metric: ScoreMetric }> = ({ metric }) => {
    const { name, score, description } = metric;
    
    const getBarColor = (s: number) => {
        if (s > 75) return 'bg-green-500';
        if (s > 40) return 'bg-yellow-500';
        return 'bg-red-500';
    };

    return (
        <div className="bg-slate-800/40 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-slate-300">{name}</span>
                <span className="text-sm font-bold text-slate-100">{score}/100</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2.5">
                <div 
                    className={`${getBarColor(score)} h-2.5 rounded-full transition-all duration-500 ease-out`} 
                    style={{ width: `${score}%` }}
                ></div>
            </div>
            <p className="text-xs text-slate-300 mt-2">{description}</p>
        </div>
    );
};

const ScoreBreakdown: React.FC<{ breakdown: ScoreBreakdownType, reasoning?: string }> = ({ breakdown, reasoning }) => {
    return (
        <div className="bg-slate-800/50 p-6 rounded-2xl space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-slate-100">Score Breakdown</h3>
                <p className="text-sm text-slate-300 mt-1">
                    Formula: <span className="font-mono text-indigo-300">{breakdown.final_score_formula}</span>
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {breakdown.metrics.map(metric => (
                    <MetricBar key={metric.name} metric={metric} />
                ))}
            </div>

            {reasoning && (
                <div className="border-t border-slate-700/50 pt-6">
                    <div className="flex items-center gap-3 mb-4">
                        <LightBulbIcon className="w-6 h-6 text-indigo-400" />
                        <h4 className="text-lg font-semibold text-slate-100">AI Analysis & Reasoning</h4>
                    </div>
                    <div className="bg-slate-800/40 p-4 rounded-lg border-l-4 border-indigo-500">
                        <p className="text-slate-200 leading-relaxed whitespace-pre-wrap">{reasoning}</p>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                        This explanation shows how external evidence was evaluated against the original claim.
                    </p>
                </div>
            )}

            {breakdown.confidence_intervals && (
                <div className="text-center text-sm text-slate-300 border-t border-slate-700/50 pt-4">
                    <div className="inline-flex items-center gap-2">
                        <span>Confidence Interval:</span>
                        <strong className="text-slate-200 bg-slate-700/50 px-2 py-1 rounded">
                            {breakdown.confidence_intervals.lower_bound} - {breakdown.confidence_intervals.upper_bound}
                        </strong>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ScoreBreakdown;