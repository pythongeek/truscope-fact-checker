import React, { useState } from 'react';
// FIX: Updated import path for FactCheckReport.
import { FactCheckReport } from '../types';
import ReportView from './ReportView';
import { CheckCircleIcon, ExclamationCircleIcon, XCircleIcon, PencilSquareIcon } from './icons';
import AutoEditor from './AutoEditor';
import DashboardSkeleton from './DashboardSkeleton';

// A new, self-contained component to visually represent the final verdict.
interface VerdictDisplayProps {
    verdict: string;
    score: number;
}

const VerdictDisplay: React.FC<VerdictDisplayProps> = ({ verdict, score }) => {
    const getVerdictStyle = (s: number) => {
        if (s > 75) {
            return {
                Icon: CheckCircleIcon,
                textColor: 'text-green-300',
                borderColor: 'border-green-500/30',
                bgColor: 'bg-green-500/10',
            };
        }
        if (s >= 40) {
            return {
                Icon: ExclamationCircleIcon,
                textColor: 'text-yellow-300',
                borderColor: 'border-yellow-500/30',
                bgColor: 'bg-yellow-500/10',
            };
        }
        return {
            Icon: XCircleIcon,
            textColor: 'text-red-300',
            borderColor: 'border-red-500/30',
            bgColor: 'bg-red-500/10',
        };
    };

    const { Icon, textColor, borderColor, bgColor } = getVerdictStyle(score);

    return (
        <div className={`flex-grow p-4 rounded-xl flex items-center gap-4 border ${borderColor} ${bgColor}`}>
            <Icon className={`w-10 h-10 flex-shrink-0 ${textColor}`} />
            <div>
                <h3 className="text-sm font-semibold text-slate-300">Final Verdict</h3>
                <p className={`text-xl font-bold ${textColor}`}>{verdict}</p>
            </div>
        </div>
    );
};

interface DashboardProps {
    result: FactCheckReport | null;
    isLoading: boolean;
}

type Tab = 'Overview' | 'Evidence' | 'Breakdown' | 'Methodology' | 'Search Results' | 'Original Text Analysis';

// A compact ScoreCircle component to replace the old ScoreCard, integrated directly into the dashboard header.
const ScoreCircle: React.FC<{ score: number }> = ({ score }) => {
    const radius = 27;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;

    const getColor = (s: number) => {
        if (s > 75) return 'stroke-green-400';
        if (s > 50) return 'stroke-yellow-400';
        return 'stroke-red-400';
    };
    
    const getTextColor = (s: number) => {
        if (s > 75) return 'text-green-400';
        if (s > 50) return 'text-yellow-400';
        return 'text-red-400';
    };

    return (
        <div className="relative w-20 h-20 flex-shrink-0">
            <svg className="w-full h-full" viewBox="0 0 60 60">
                <circle className="text-slate-700" strokeWidth="6" stroke="currentColor" fill="transparent" r={radius} cx="30" cy="30" />
                <circle
                    className={`${getColor(score)} transition-all duration-1000 ease-out`}
                    strokeWidth="6"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r={radius}
                    cx="30"
                    cy="30"
                    transform="rotate(-90 30 30)"
                />
            </svg>
            <div className={`absolute inset-0 flex items-center justify-center text-xl font-bold ${getTextColor(score)}`}>
                {score}
            </div>
        </div>
    );
};

const Dashboard: React.FC<DashboardProps> = ({ result, isLoading }) => {
    const [activeTab, setActiveTab] = useState<Tab>('Overview');
    const [isEditorOpen, setIsEditorOpen] = useState(false);

    if (isLoading) {
        return <DashboardSkeleton />;
    }

    if (!result) {
        return null;
    }

    // Add a final sanity check for essential data before rendering
    if (!result.final_verdict || !result.score_breakdown || !result.evidence) {
        return (
            <div className="text-center py-10 text-slate-400">
                <p>Error: Incomplete analysis report received. Please try again.</p>
            </div>
        );
    }

    // Show Original Text Analysis tab only if segments are available
    const availableTabs: Tab[] = ['Overview'];
    if (result.originalTextSegments && result.originalTextSegments.length > 0) {
        availableTabs.push('Original Text Analysis');
    }
    availableTabs.push('Evidence', 'Breakdown', 'Methodology', 'Search Results');


    return (
        <div className="space-y-6">
            {/* Header Section */}
            <div className="bg-slate-800/50 p-6 rounded-2xl flex items-center gap-6">
                 <ScoreCircle score={result.final_score} />
                 <VerdictDisplay verdict={result.final_verdict} score={result.final_score} />
                 <button
                    onClick={() => setIsEditorOpen(true)}
                    className="ml-auto bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                >
                    <PencilSquareIcon className="w-5 h-5" />
                    <span>Auto-Edit Content</span>
                </button>
            </div>

            {/* Tab Navigation */}
            <nav className="flex items-center gap-2 p-1 bg-slate-800/50 rounded-lg overflow-x-auto">
                {availableTabs.map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-shrink-0 px-4 py-2 text-sm font-semibold rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                            activeTab === tab 
                                ? 'bg-indigo-600 text-white shadow-md' 
                                : 'text-slate-300 hover:bg-slate-700/50'
                        }`}
                        aria-current={activeTab === tab ? 'page' : undefined}
                    >
                        {tab}
                    </button>
                ))}
            </nav>

            {/* Tab Content */}
            <div className="min-h-[200px]">
                <ReportView report={result} activeTab={activeTab} />
            </div>

            <AutoEditor
                isOpen={isEditorOpen}
                onClose={() => setIsEditorOpen(false)}
                originalText={result.originalText}
                factCheckReport={result}
            />
        </div>
    );
};

export default Dashboard;