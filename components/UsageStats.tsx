import React from 'react';

interface UsageStatsProps {
  dailyUsage: number;
  dailyLimit: number;
}

const UsageStats: React.FC<UsageStatsProps> = ({ dailyUsage, dailyLimit }) => {
  const percentage = (dailyUsage / dailyLimit) * 100;

  return (
    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 mb-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm text-slate-400">Daily Usage</span>
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
    </div>
  );
};

export default UsageStats;
