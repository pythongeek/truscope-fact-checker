// src/components/DashboardSkeleton.tsx
import React from 'react';

const DashboardSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="animate-pulse space-y-4">
        <div className="h-16 bg-gray-300 rounded"></div>
        <div className="h-12 bg-gray-300 rounded w-1/2"></div>
        <div className="grid grid-cols-3 gap-4">
          <div className="h-40 bg-gray-300 rounded col-span-1"></div>
          <div className="h-40 bg-gray-300 rounded col-span-2"></div>
        </div>
        <div className="h-64 bg-gray-300 rounded"></div>
      </div>
    </div>
  );
};

export default DashboardSkeleton;
