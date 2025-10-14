import React, { useState, useMemo, ReactNode } from 'react';
import { EvidenceItem, Source } from '@/types';
import { ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';

interface EvidenceTableProps {
  evidence: EvidenceItem[];
}

// --- Self-Contained UI Components to Fix Build Errors ---

// FIX: Replaced all custom UI component imports with standard HTML elements
// styled with Tailwind CSS to resolve the "Cannot find module" build errors.
// This ensures the component works without needing external UI component files.

const Badge = ({ children, variant }: { children: React.ReactNode, variant?: string }) => (
  <span className={`border rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${variant === 'outline' ? 'text-foreground' : ''}`}>
    {children}
  </span>
);

const Table: React.FC<React.TableHTMLAttributes<HTMLTableElement>> = ({ className, ...props }) => (
  <div className="relative w-full overflow-auto">
    <table className={`w-full caption-bottom text-sm ${className}`} {...props} />
  </div>
);

const TableHeader: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({ className, ...props }) => (
  <thead className={`[&_tr]:border-b ${className}`} {...props} />
);

const TableBody: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({ className, ...props }) => (
  <tbody className={`[&_tr:last-child]:border-0 ${className}`} {...props} />
);

const TableRow: React.FC<React.HTMLAttributes<HTMLTableRowElement>> = ({ className, ...props }) => (
  <tr className={`border-b transition-colors hover:bg-gray-100/50 data-[state=selected]:bg-gray-100 ${className}`} {...props} />
);

const TableHead: React.FC<React.ThHTMLAttributes<HTMLTableCellElement>> = ({ className, ...props }) => (
  <th className={`h-12 px-4 text-left align-middle font-medium text-gray-500 [&:has([role=checkbox])]:pr-0 ${className}`} {...props} />
);

const TableCell: React.FC<React.TdHTMLAttributes<HTMLTableCellElement>> = ({ className, ...props }) => (
  <td className={`p-4 align-middle [&:has([role=checkbox])]:pr-0 ${className}`} {...props} />
);

// Simple, self-contained Tooltip implementation using Tailwind's group-hover.
const TooltipProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>;
const Tooltip = ({ children }: { children: React.ReactNode }) => <div className="group relative inline-flex">{children}</div>;
const TooltipTrigger = ({ children }: { children: React.ReactNode }) => <>{children}</>;
const TooltipContent = ({ children }: { children: React.ReactNode }) => (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs scale-0 group-hover:scale-100 transition-transform duration-100 ease-in-out origin-bottom bg-gray-800 text-white text-sm rounded-md px-3 py-1.5 z-10">
        {children}
        <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-800"></div>
    </div>
);


// --- Main EvidenceTable Component ---

const EvidenceTable: React.FC<EvidenceTableProps> = ({ evidence }) => {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: keyof EvidenceItem; direction: 'ascending' | 'descending' } | null>({ key: 'relevanceScore', direction: 'descending' });

  const sortedEvidence = useMemo(() => {
    let sortableItems = [...evidence];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
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
    const numericScore = score ?? 0;
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
  
  const renderSourceInfo = (item: EvidenceItem) => {
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
                      <TooltipTrigger>
                        <p className="truncate max-w-xs">{item.quote || "No quote available."}</p>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{item.quote || "No quote available."}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
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

