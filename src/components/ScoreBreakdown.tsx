import React from 'react';
// FIX: Corrected import path for types and aliased ScoreBreakdown to avoid naming conflict.
import { ScoreBreakdown as ScoreBreakdownType, ScoreMetric } from '../types/factCheck';

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
                <div className="border-t border-slate-700/50 pt-4">
                    <h4 className="text-md font-semibold text-slate-200 mb-2">AI Reasoning</h4>
                    <p className="text-sm text-slate-300 whitespace-pre-wrap">{reasoning}</p>
                </div>
            )}
            {breakdown.confidence_intervals && (
                <div className="text-center text-sm text-slate-300 border-t border-slate-700/50 pt-4">
                    Confidence Interval: 
                    <strong className="text-slate-200"> {breakdown.confidence_intervals.lower_bound} - {breakdown.confidence_intervals.upper_bound}</strong>
                </div>
            )}
        </div>
    );
};

export default ScoreBreakdown;