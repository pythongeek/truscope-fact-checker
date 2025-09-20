import React from 'react';

const DashboardSkeleton: React.FC = () => {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Header Skeleton */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1">
            <div className="flex flex-col items-center space-y-4">
              <div className="h-4 bg-slate-700 rounded w-2/3"></div>
              <div className="h-10 bg-slate-700 rounded w-1/2"></div>
              <div className="h-6 bg-slate-700 rounded w-1/3"></div>
            </div>
          </div>
          <div className="md:col-span-2 space-y-3">
            <div className="h-4 bg-slate-700 rounded w-1/4"></div>
            <div className="h-4 bg-slate-700 rounded"></div>
            <div className="h-4 bg-slate-700 rounded"></div>
            <div className="h-4 bg-slate-700 rounded w-5/6"></div>
          </div>
        </div>
      </div>

      {/* Tab Navigation Skeleton */}
      <div className="border-b border-slate-700">
        <div className="flex space-x-8">
          <div className="h-10 bg-slate-700 rounded w-24"></div>
          <div className="h-10 bg-slate-700 rounded w-32"></div>
          <div className="h-10 bg-slate-700 rounded w-40"></div>
        </div>
      </div>

      {/* Tab Content Skeleton */}
      <div className="space-y-4">
        <div className="h-32 bg-slate-800/50 rounded-xl"></div>
        <div className="h-64 bg-slate-800/50 rounded-xl"></div>
      </div>
    </div>
  );
};

export default DashboardSkeleton;
