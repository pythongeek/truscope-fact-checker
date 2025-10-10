import React, { useState, useEffect } from 'react';
import { EnhancedHistoryService } from '../../services/enhancedHistoryService';
import { TieredFactCheckResult } from '../../types/factCheck';
import EnhancedFactCheckReport from '../EnhancedFactCheckReport';
import { FileText, Loader, ServerCrash } from 'lucide-react';

const ComplianceDashboard: React.FC = () => {
  const [auditTrailIds, setAuditTrailIds] = useState<string[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<TieredFactCheckResult | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingRecord, setIsLoadingRecord] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const historyService = new EnhancedHistoryService();

  useEffect(() => {
    const fetchAuditTrails = async () => {
      setIsLoadingList(true);
      setError(null);
      try {
        const ids = await historyService.getAuditTrailList();
        setAuditTrailIds(ids);
      } catch (e) {
        setError('Failed to load audit trail records.');
        console.error(e);
      } finally {
        setIsLoadingList(false);
      }
    };
    fetchAuditTrails();
  }, []);

  const handleSelectRecord = async (recordId: string) => {
    if (selectedId === recordId) return;

    setSelectedId(recordId);
    setIsLoadingRecord(true);
    setSelectedRecord(null);
    setError(null);

    try {
      const record = await historyService.getAuditTrailRecord(recordId);
      if (record) {
        setSelectedRecord(record);
      } else {
        throw new Error('Record not found');
      }
    } catch (e) {
      setError(`Failed to load record: ${recordId}`);
      console.error(e);
    } finally {
      setIsLoadingRecord(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Compliance & Audit Dashboard</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Audit Trail Records</h2>
          {isLoadingList ? (
            <div className="flex items-center space-x-2 text-gray-500">
              <Loader className="animate-spin h-5 w-5" />
              <span>Loading records...</span>
            </div>
          ) : error && auditTrailIds.length === 0 ? (
             <div className="flex items-center space-x-2 text-red-500">
              <ServerCrash className="h-5 w-5" />
              <span>{error}</span>
            </div>
          ) : (
            <ul className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
              {auditTrailIds.map((id) => (
                <li key={id}>
                  <button
                    onClick={() => handleSelectRecord(id)}
                    className={`w-full text-left p-3 rounded-md transition-all flex items-center space-x-3
                      ${selectedId === id
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                  >
                    <FileText className="h-5 w-5" />
                    <span className="truncate text-sm font-medium">{id}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="lg:col-span-2">
           <h2 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Record Details</h2>
           <div className="p-4 bg-gray-50 rounded-lg min-h-[60vh]">
            {isLoadingRecord ? (
              <div className="flex items-center justify-center h-full space-x-2 text-gray-500">
                <Loader className="animate-spin h-8 w-8" />
                <span className="text-lg">Loading record details...</span>
              </div>
            ) : error && !selectedRecord ? (
              <div className="flex items-center justify-center h-full space-x-2 text-red-500">
                <ServerCrash className="h-8 w-8" />
                <span className="text-lg">{error}</span>
              </div>
            ) : selectedRecord ? (
              <EnhancedFactCheckReport report={selectedRecord} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <p>Select a record from the list to view its details.</p>
              </div>
            )}
           </div>
        </div>
      </div>
    </div>
  );
};

export default ComplianceDashboard;