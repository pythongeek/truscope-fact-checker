import React from 'react';

/**
 * Defines the properties for the UsageStats component.
 */
interface UsageStatsProps {
  /**
   * The number of API requests made today.
   */
  dailyUsage: number;
  /**
   * The total daily API request limit for a shared key.
   */
  dailyLimit: number;
  /**
   * A boolean indicating whether the user is using their own API key.
   */
  usingUserApiKey: boolean;
}

/**
 * A component that displays API usage statistics.
 * It shows either the unlimited usage status for a personal API key
 * or the daily usage and limit for a shared API key, including a progress bar.
 *
 * @param {UsageStatsProps} props - The properties for the UsageStats component.
 * @returns {JSX.Element} The rendered usage statistics component.
 */
const UsageStats: React.FC<UsageStatsProps> = ({ dailyUsage, dailyLimit, usingUserApiKey }) => {
  if (usingUserApiKey) {
    return (
      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
            <span className="text-sm text-slate-300">Using your personal API key</span>
          </div>
          <span className="text-sm text-green-400 font-medium">Unlimited Usage</span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-2 mt-2">
          <div className="h-2 rounded-full bg-green-500 w-full" />
        </div>
      </div>
    );
  }

  const percentage = (dailyUsage / dailyLimit) * 100;

  return (
    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 mb-4">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center space-x-2">
          <span className="text-sm text-slate-400">Daily Usage (Shared API)</span>
          <div className="w-2 h-2 bg-amber-400 rounded-full" />
        </div>
        <span className="text-sm text-slate-300">{dailyUsage} / {dailyLimit}</span>
      </div>
      <div className="w-full bg-slate-700 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${
            percentage > 80 ? 'bg-red-500' : percentage > 60 ? 'bg-yellow-500' : 'bg-green-500'
          }`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      {percentage > 80 && (
        <p className="text-xs text-amber-400 mt-2">
          Approaching daily limit. Consider adding your own API key for unlimited usage.
        </p>
      )}
    </div>
  );
};

export default UsageStats;
