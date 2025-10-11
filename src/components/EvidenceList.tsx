// src/components/EvidenceList.tsx

import React from 'react';
import { EvidenceItem } from '@/types';
import { ExternalLink, CheckCircle, Newspaper, Search } from 'lucide-react';

const SOURCE_ICONS = {
    search_result: <Search className="w-4 h-4 text-blue-500" />,
    news: <Newspaper className="w-4 h-4 text-green-500" />,
    claim: <CheckCircle className="w-4 h-4 text-purple-500" />,
    'cached-database': <CheckCircle className="w-4 h-4 text-gray-500" />,
    academic: <CheckCircle className="w-4 h-4 text-yellow-500" />,
    other: <Search className="w-4 h-4 text-gray-500" />,
};

interface EvidenceListProps {
  evidence: EvidenceItem[];
}

export const EvidenceList: React.FC<EvidenceListProps> = ({ evidence }) => {
  if (evidence.length === 0) {
    return <div className="text-center text-gray-500 py-8">No evidence found for this query.</div>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Evidence Sources ({evidence.length})</h3>
      <ul className="divide-y divide-gray-200">
        {evidence.map((item) => (
          <li key={item.id} className="py-4">
            <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 pt-1">
                    {SOURCE_ICONS[item.type as keyof typeof SOURCE_ICONS] || SOURCE_ICONS.other}
                </div>
              <div className="flex-1">
                <a
                  href={item.url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline font-semibold"
                >
                  {item.publisher} <ExternalLink className="inline-block w-4 h-4 ml-1" />
                </a>
                <p className="text-sm text-gray-500">{item.publisher}</p>
                <p className="mt-2 text-gray-700">{item.quote}</p>
                {item.publishedDate && (
                    <p className="text-xs text-gray-400 mt-2">
                        Published on: {new Date(item.publishedDate).toLocaleDateString()}
                    </p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};