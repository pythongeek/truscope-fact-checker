// src/components/EvidenceTable.tsx
import React, { useState, useMemo } from 'react';
import { EvidenceItem } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';

interface EvidenceTableProps {
  evidence: EvidenceItem[];
}

const EvidenceTable: React.FC<EvidenceTableProps> = ({ evidence }) => {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: keyof EvidenceItem; direction: 'ascending' | 'descending' } | null>({ key: 'relevanceScore', direction: 'descending' });

  const sortedEvidence = useMemo(() => {
    let sortableItems = [...evidence];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [evidence, sortConfig]);

  const requestSort = (key: keyof EvidenceItem) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const getSortIndicator = (key: keyof EvidenceItem) => {
    if (!sortConfig || sortConfig.key !== key) {
      return null;
    }
    return sortConfig.direction === 'ascending' ? <ChevronUp className="h-4 w-4 inline" /> : <ChevronDown className="h-4 w-4 inline" />;
  };

  const toggleRow = (id: string) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  const renderScore = (score: number, label: string) => (
    <div className="flex items-center">
      <div className="w-16 text-sm text-gray-600">{label}:</div>
      <div className="w-full bg-gray-200 rounded-full h-2.5 ml-2">
        <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${score}%` }}></div>
      </div>
      <div className="text-sm font-medium text-gray-700 ml-2">{score.toFixed(0)}</div>
    </div>
  );

  const renderSourceInfo = (item: EvidenceItem) => {
    // Fallback for publication date if it's missing or invalid
    const publicationDate = item.source?.publication_date ? new Date(item.source.publication_date).toLocaleDateString() : 'N/A';

    return (
        <div className="text-sm text-gray-600">
            <p><strong>Source:</strong> {item.source?.name || 'Unknown'}</p>
            <p><strong>Publication Date:</strong> {publicationDate}</p>
            {/* Add more details as they become available */}
        </div>
    );
  };


  if (!evidence || evidence.length === 0) {
    return <p className="text-center text-gray-500 py-4">No evidence found for this claim.</p>;
  }

  return (
    <TooltipProvider>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead onClick={() => requestSort('publisher')}>
                Source {getSortIndicator('publisher')}
              </TableHead>
              <TableHead>Evidence</TableHead>
              <TableHead onClick={() => requestSort('relevanceScore')}>
                Relevance {getSortIndicator('relevanceScore')}
              </TableHead>
              <TableHead onClick={() => requestSort('credibilityScore')}>
                Credibility {getSortIndicator('credibilityScore')}
              </TableHead>
              <TableHead>Link</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedEvidence.map((item) => (
              <React.Fragment key={item.id}>
                <TableRow onClick={() => toggleRow(item.id)} className="cursor-pointer">
                  <TableCell className="font-medium">{item.publisher}</TableCell>
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className="truncate max-w-xs">{item.quote || "No quote available."}</p>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{item.quote || "No quote available."}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell>{item.relevanceScore.toFixed(2)}</TableCell>
                  <TableCell>{item.credibilityScore.toFixed(2)}</TableCell>
                  <TableCell>
                    <a href={item.url || '#'} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </TableCell>
                </TableRow>
                {expandedRow === item.id && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <h4 className="font-semibold text-md mb-2">Detailed View</h4>
                        <p className="text-sm text-gray-700 mb-3">{item.snippet || "No snippet available"}</p>
                        <div className="space-y-2">
                          {renderScore(item.relevanceScore, 'Relevance')}
                          {renderScore(item.credibilityScore, 'Credibility')}
                        </div>
                        <div className="mt-3">
                           {renderSourceInfo(item)}
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
};

export default EvidenceTable;
