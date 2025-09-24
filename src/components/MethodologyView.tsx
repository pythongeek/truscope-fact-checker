import React from 'react';
// FIX: Updated import path for FactCheckMetadata.
import { FactCheckMetadata } from '@/types/factCheck';
import { ExclamationCircleIcon } from './icons';

const InfoCard: React.FC<{ title: string, children: React.ReactNode, className?: string }> = ({ title, children, className }) => (
    <div className={`bg-slate-800/40 p-4 rounded-lg ${className}`}>
        <h4 className="font-semibold text-indigo-300 text-sm mb-2">{title}</h4>
        {children}
    </div>
);

const MethodologyView: React.FC<{ metadata: FactCheckMetadata }> = ({ metadata }) => {
    return (
        <div className="bg-slate-800/50 p-6 rounded-2xl space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-slate-100">Analysis Methodology</h3>
                <p className="text-sm text-slate-300 mt-1">
                    An overview of the process and data used for this fact-check report.
                </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <InfoCard title="Analysis Method">
                    <p className="text-slate-100 font-medium">{metadata.method_used}</p>
                </InfoCard>
                <InfoCard title="Processing Time">
                     <p className="text-slate-100 font-medium">{metadata.processing_time_ms} ms</p>
                </InfoCard>
                <InfoCard title="APIs Used">
                     <p className="text-slate-100 font-medium">{metadata.apis_used.join(', ')}</p>
                </InfoCard>
            </div>
            
            <InfoCard title="Sources Consulted">
                 <div className="flex justify-around">
                    <div className="text-center">
                        <p className="text-2xl font-bold text-slate-100">{metadata.sources_consulted.total}</p>
                        <p className="text-xs text-slate-300">Total Sources</p>
                    </div>
                     <div className="text-center">
                        <p className="text-2xl font-bold text-green-400">{metadata.sources_consulted.high_credibility}</p>
                        <p className="text-xs text-slate-300">High-Credibility</p>
                    </div>
                     <div className="text-center">
                        <p className="text-2xl font-bold text-red-400">{metadata.sources_consulted.conflicting}</p>
                        <p className="text-xs text-slate-300">Conflicting</p>
                    </div>
                </div>
            </InfoCard>

            {metadata.warnings.length > 0 && (
                <InfoCard title="Warnings" className="!bg-yellow-500/10">
                    <div className="space-y-2">
                        {metadata.warnings.map((warning, index) => (
                            <div key={index} className="flex items-start gap-2 text-yellow-300">
                                <ExclamationCircleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                <p className="text-sm">{warning}</p>
                            </div>
                        ))}
                    </div>
                </InfoCard>
            )}
        </div>
    );
};

export default MethodologyView;