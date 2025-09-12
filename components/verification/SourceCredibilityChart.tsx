// AI CODING INSTRUCTION: Create an interactive credibility visualization
// showing source quality distribution and verification confidence

import React, { useMemo } from 'react';
import type { SourceAnalysis } from '../../types/verification';

interface SourceCredibilityChartProps {
  sources: SourceAnalysis[];
}

const SourceCredibilityChart: React.FC<SourceCredibilityChartProps> = ({ sources }) => {
  const aggregateCredibility = useMemo(() => {
    if (!sources || !sources.length) return null;

    const total = sources.reduce((acc, source) => {
      if (!source || !source.credibility_distribution) return acc;
      return {
        high: acc.high + (source.credibility_distribution.high || 0),
        medium: acc.medium + (source.credibility_distribution.medium || 0),
        low: acc.low + (source.credibility_distribution.low || 0),
        total_sources: acc.total_sources + (source.total_sources || 0)
      }
    }, { high: 0, medium: 0, low: 0, total_sources: 0 });

    if (total.total_sources === 0) {
      return null;
    }

    return {
      high_percentage: (total.high / total.total_sources) * 100,
      medium_percentage: (total.medium / total.total_sources) * 100,
      low_percentage: (total.low / total.total_sources) * 100,
    };
  }, [sources]);

  if (!aggregateCredibility) {
    return <div className="text-slate-400">No source data available</div>;
  }

  return (
    <div className="credibility-chart">
      {/* Visual credibility breakdown */}
      <div className="credibility-bars mb-4">
        <div className="bar-container h-8 bg-slate-700 rounded-lg overflow-hidden flex">
          <div
            className="bg-green-500"
            style={{ width: `${aggregateCredibility.high_percentage}%` }}
            title={`High Credibility: ${aggregateCredibility.high_percentage.toFixed(1)}%`}
          />
          <div
            className="bg-yellow-500"
            style={{ width: `${aggregateCredibility.medium_percentage}%` }}
            title={`Medium Credibility: ${aggregateCredibility.medium_percentage.toFixed(1)}%`}
          />
          <div
            className="bg-red-500"
            style={{ width: `${aggregateCredibility.low_percentage}%` }}
            title={`Low Credibility: ${aggregateCredibility.low_percentage.toFixed(1)}%`}
          />
        </div>
      </div>

      {/* Legend and statistics */}
      <div className="credibility-legend grid grid-cols-3 gap-2 text-sm">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-green-500 rounded"></div>
          <span className="text-slate-300">
            High ({aggregateCredibility.high_percentage.toFixed(1)}%)
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-yellow-500 rounded"></div>
          <span className="text-slate-300">
            Medium ({aggregateCredibility.medium_percentage.toFixed(1)}%)
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-red-500 rounded"></div>
          <span className="text-slate-300">
            Low ({aggregateCredibility.low_percentage.toFixed(1)}%)
          </span>
        </div>
      </div>
    </div>
  );
};

export default SourceCredibilityChart;
