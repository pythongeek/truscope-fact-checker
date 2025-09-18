import React, { useState, useMemo } from 'react';
// FIX: Updated import path for EvidenceItem.
import { EvidenceItem } from '../types/factCheck';

type SortKey = 'publisher' | 'score';
type SortOrder = 'asc' | 'desc';

const ReliabilityBadge: React.FC<{ score: number }> = ({ score }) => {
    const getBadgeStyle = (s: number) => {
        if (s > 80) return { bg: 'bg-green-500/20', text: 'text-green-300', label: 'High' };
        if (s > 50) return { bg: 'bg-yellow-500/20', text: 'text-yellow-300', label: 'Medium' };
        return { bg: 'bg-red-500/20', text: 'text-red-300', label: 'Low' };
    };
    const { bg, text, label } = getBadgeStyle(score);
    return (
        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${bg} ${text}`}>
            {label} ({score})
        </span>
    );
};

const SortIcon: React.FC<{ order: SortOrder, active: boolean }> = ({ order, active }) => {
    if (!active) {
        return <span className="text-slate-500">↕</span>;
    }
    return order === 'asc' ? <span className="text-white">↑</span> : <span className="text-white">↓</span>;
};

const Highlight: React.FC<{ text: string; highlight: string }> = ({ text, highlight }) => {
    if (!highlight.trim()) {
        return <span>{text}</span>;
    }
    // Escape special regex characters to ensure the filter text is treated as a literal string
    const escapedHighlight = highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedHighlight})`, 'gi');
    const parts = text.split(regex);
    
    return (
        <span>
            {parts.map((part, i) =>
                // The parts array alternates between non-matching and matching segments.
                // Matching segments are at odd indices.
                i % 2 === 1 ? (
                    <mark key={i} className="bg-yellow-500/30 text-yellow-200 px-0.5 rounded-sm">
                        {part}
                    </mark>
                ) : (
                    part
                )
            )}
        </span>
    );
};

const EvidenceTable: React.FC<{ evidence: EvidenceItem[] }> = ({ evidence }) => {
    const [sortKey, setSortKey] = useState<SortKey>('score');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
    const [filter, setFilter] = useState('');
    const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

    const handleSort = (key: SortKey) => {
        if (key === sortKey) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortOrder('desc');
        }
    };

    const handleRowClick = (id: string) => {
        setExpandedRowId(prevId => (prevId === id ? null : id));
    };
    
    const filteredAndSortedEvidence = useMemo(() => {
        const lowercasedFilter = filter.toLowerCase();
        
        return [...evidence]
            .filter(item => 
                item.quote.toLowerCase().includes(lowercasedFilter) ||
                item.publisher.toLowerCase().includes(lowercasedFilter)
            )
            .sort((a, b) => {
                if (a[sortKey] < b[sortKey]) return sortOrder === 'asc' ? -1 : 1;
                if (a[sortKey] > b[sortKey]) return sortOrder === 'asc' ? 1 : -1;
                return 0;
            });
    }, [evidence, sortKey, sortOrder, filter]);

    if (evidence.length === 0) {
        return (
            <div className="bg-slate-800/50 p-6 rounded-2xl text-center">
                <p className="text-slate-300">No specific evidence was found for this analysis.</p>
            </div>
        );
    }

    return (
        <div className="bg-slate-800/50 rounded-2xl overflow-hidden">
            <div className="p-4 bg-slate-900/50 border-b border-slate-800">
                <input
                    type="text"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Filter by quote or publisher..."
                    className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-slate-200 placeholder-slate-400"
                    aria-label="Filter evidence"
                />
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-300">
                    <thead className="text-xs text-slate-300 uppercase bg-slate-900/50">
                        <tr>
                            <th scope="col" className="px-6 py-3">Evidence</th>
                             <th scope="col" className="px-6 py-3 cursor-pointer" onClick={() => handleSort('publisher')}>
                                <div className="flex items-center gap-1">
                                    Publisher <SortIcon order={sortOrder} active={sortKey==='publisher'}/>
                                </div>
                            </th>
                            <th scope="col" className="px-6 py-3 cursor-pointer" onClick={() => handleSort('score')}>
                                <div className="flex items-center gap-1">
                                    Reliability <SortIcon order={sortOrder} active={sortKey==='score'}/>
                                </div>
                            </th>
                            <th scope="col" className="px-2 py-3">
                                <span className="sr-only">Expand</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredAndSortedEvidence.length > 0 ? (
                            filteredAndSortedEvidence.map((item) => (
                                <React.Fragment key={item.id}>
                                    <tr
                                        className="border-b border-slate-800 hover:bg-slate-800/40 transition-colors cursor-pointer"
                                        onClick={() => handleRowClick(item.id)}
                                        aria-expanded={expandedRowId === item.id}
                                    >
                                        <td className="px-6 py-4">
                                            <p className="font-medium text-slate-200 line-clamp-2">
                                                <Highlight text={item.quote} highlight={filter} />
                                            </p>
                                        </td>
                                        <td className="px-6 py-4">
                                            {item.url ? (
                                                <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline" onClick={(e) => e.stopPropagation()}>
                                                    <Highlight text={item.publisher} highlight={filter} />
                                                </a>
                                            ) : (
                                                <span>
                                                    <Highlight text={item.publisher} highlight={filter} />
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <ReliabilityBadge score={item.score} />
                                        </td>
                                        <td className="px-2 py-4 text-center">
                                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-slate-300 transition-transform transform ${expandedRowId === item.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </td>
                                    </tr>
                                    {expandedRowId === item.id && (
                                        <tr className="bg-slate-800/20">
                                            <td colSpan={4} className="px-6 py-4">
                                                <div className="space-y-3 p-4 bg-slate-800/50 rounded-lg">
                                                    <div>
                                                        <h4 className="text-sm font-semibold text-slate-300 mb-1">Full Quote</h4>
                                                        <p className="text-slate-300 whitespace-pre-wrap">
                                                            <Highlight text={item.quote} highlight={filter} />
                                                        </p>
                                                    </div>
                                                    {item.url && (
                                                        <div>
                                                            <h4 className="text-sm font-semibold text-slate-300 mb-1">Source URL</h4>
                                                            <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline break-all text-sm" onClick={(e) => e.stopPropagation()}>
                                                                {item.url}
                                                            </a>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={4} className="text-center py-8 px-6 text-slate-300">
                                    No evidence matches your filter.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default EvidenceTable;