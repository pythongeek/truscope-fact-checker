// src/components/SchemaModal.tsx

import React from 'react';
import { X, Copy } from 'lucide-react';

interface SchemaModalProps {
  schema: object;
  onClose: () => void;
}

export const SchemaModal: React.FC<SchemaModalProps> = ({ schema, onClose }) => {
  const schemaString = JSON.stringify(schema, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(schemaString);
    alert('Schema copied to clipboard!');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <h2 className="text-xl font-bold">ClaimReview JSON-LD Schema</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
            <X size={24} />
          </button>
        </div>
        <div className="flex-grow overflow-y-auto bg-gray-50 p-3 rounded">
          <pre className="text-sm whitespace-pre-wrap">{schemaString}</pre>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleCopy}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center"
          >
            <Copy size={18} className="mr-2" />
            Copy Schema
          </button>
        </div>
      </div>
    </div>
  );
};