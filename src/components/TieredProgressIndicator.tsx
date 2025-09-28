import React from 'react';

export interface TierProgress {
  tier: string;
  status: 'pending' | 'active' | 'completed' | 'failed';
  confidence?: number;
  evidenceCount?: number;
}

interface TieredProgressIndicatorProps {
  progress: TierProgress[];
  currentPhase: number;
}

export const TieredProgressIndicator: React.FC<TieredProgressIndicatorProps> = ({
  progress,
  currentPhase
}) => {
  const getStatusColor = (status: TierProgress['status']) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'active': return 'bg-blue-500 animate-pulse';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-300';
    }
  };

  const getStatusIcon = (status: TierProgress['status']) => {
    switch (status) {
      case 'completed': return '✅';
      case 'active': return '⏳';
      case 'failed': return '❌';
      default: return '⭕';
    }
  };

  return (
    <div className="w-full p-4 bg-gray-50 rounded-lg">
      <h3 className="text-lg font-semibold mb-4">Verification Progress</h3>

      <div className="space-y-3">
        {progress.map((tier, index) => (
          <div key={index} className="flex items-center space-x-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${getStatusColor(tier.status)}`}>
              {index + 1}
            </div>

            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-medium capitalize">
                  {tier.tier.replace('-', ' ')} {getStatusIcon(tier.status)}
                </span>

                {tier.status === 'completed' && tier.confidence && (
                  <span className="text-sm text-gray-600">
                    {tier.confidence}% confidence • {tier.evidenceCount} sources
                  </span>
                )}
              </div>

              {tier.status === 'active' && (
                <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 text-sm text-gray-600">
        Phase {currentPhase} of {progress.length} • Optimized for accuracy and cost efficiency
      </div>
    </div>
  );
};