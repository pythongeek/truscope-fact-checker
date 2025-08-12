
import React from 'react';
import type { IconProps } from './Icons';

interface TabButtonProps {
  label: string;
  Icon: React.ComponentType<IconProps>;
  isActive: boolean;
  onClick: () => void;
}

export const TabButton: React.FC<TabButtonProps> = ({ label, Icon, isActive, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-all duration-200
        ${
          isActive
            ? 'border-blue-500 text-blue-600'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
        }`}
    >
      <Icon className={`-ml-0.5 mr-2 h-5 w-5 transition-colors duration-200 ${isActive ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'}`} />
      <span>{label}</span>
    </button>
  );
};
