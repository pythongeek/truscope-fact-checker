// src/components/EvidenceTable.tsx
import React, { useState, useMemo, ReactNode } from 'react';
import { EvidenceItem, Source } from '@/types';
// FIX: Assuming '@/' alias is configured to src/. These imports point to your UI library components.
// If these paths are incorrect, please adjust them to match your project structure.
// The build error "Cannot find module" suggests a misconfiguration in your tsconfig.json or vite.config.ts.
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
        // FIX: Added nullish coalescing operators (??) to prevent 'possibly undefined' errors during sorting.
        // This provides default values if a property is null or undefined.
        const aValue = a[sortConfig.key] ?? 0;
        const bValue = b[sortConfig.key] ?? 0;

        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
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

  const getSortIndicator = (key: keyof EvidenceItem): ReactNode | null => {
    if (!sortConfig || sortConfig.key !== key) {
      return null;
    }
    return sortConfig.direction === 'ascending' ? <ChevronUp className="h-4 w-4 inline" /> : <ChevronDown className="h-4 w-4 inline" />;
  };

  const toggleRow = (id: string) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  const renderScore = (score: number | undefined, label: string) => {
    const numericScore = score ?? 0; // Default to 0 if score is undefined
    return (
        <div className="flex items-center">
            <div className="w-24 text-sm text-gray-600">{label}:</div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 ml-2">
                <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${numericScore}%` }}></div>
            </div>
            <div className="text-sm font-medium text-gray-700 ml-2">{numericScore.toFixed(0)}</div>
        </div>
    );
  };
  
  // IMPROVEMENT: Enhanced source information rendering for more detail and robustness.
  const renderSourceInfo = (item: EvidenceItem) => {
    // Cast source to include potentially optional properties for more detailed output
    const source = item.source as Source & { publication_date?: string; site_name?: string, type?: string };

    const publicationDate = source?.publication_date
      ? new Date(source.publication_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : 'N/A';

    return (
        <div className="text-sm text-gray-600 grid grid-cols-2 gap-x-4 gap-y-2">
            <p><strong>Source:</strong> {source?.name || 'Unknown'}</p>
            <p><strong>Site Name:</strong> {source?.site_name || 'N/A'}</p>
            <p><strong>Publication Date:</strong> {publicationDate}</p>
            <p><strong>Source Type:</strong> <Badge variant="outline">{source?.type || 'General'}</Badge></p>
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
                  <TableCell className="font-medium">{item.publisher || 'N/A'}</TableCell>
                  <TableCell>
                    <Tooltip>
                      {/* FIX: Removed the 'asChild' prop which was causing a type error. 
                          The TooltipTrigger will wrap the child element by default. */}
                      <TooltipTrigger>
                        <p className="truncate max-w-xs">{item.quote || "No quote available."}</p>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{item.quote || "No quote available."}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  {/* FIX: Added default value to prevent crash if scores are undefined */}
                  <TableCell>{(item.relevanceScore ?? 0).toFixed(2)}</TableCell>
                  <TableCell>{(item.credibilityScore ?? 0).toFixed(2)}</TableCell>
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
                        <div className="space-y-2 mb-3">
                          {renderScore(item.relevanceScore, 'Relevance')}
                          {renderScore(item.credibilityScore, 'Credibility')}
                        </div>
                        <div className="mt-3 border-t pt-3">
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
