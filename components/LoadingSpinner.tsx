
import React from 'react';

interface LoadingSpinnerProps {
  message: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ message }) => {
  return (
    <div className="mt-8 text-center bg-white/70 backdrop-blur-sm p-8 rounded-2xl shadow-md border border-gray-200/50">
      <div className="flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600"></div>
      </div>
      <p className="mt-4 text-lg font-semibold text-blue-800">{message}</p>
    </div>
  );
};
