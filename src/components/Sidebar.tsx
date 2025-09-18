import React from 'react';
import { ShieldCheckIcon } from './icons';

interface SidebarProps {
    onSettingsClick: () => void;
    currentView: 'checker' | 'history';
    onNavigate: (view: 'checker' | 'history') => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onSettingsClick, currentView, onNavigate }) => {
    return (
        <aside className="w-64 bg-slate-900/70 backdrop-blur-lg p-6 border-r border-slate-800 flex-shrink-0 hidden md:flex flex-col">
            <div className="flex items-center gap-3 mb-10">
                <ShieldCheckIcon className="w-8 h-8 text-indigo-400" />
                <h1 className="text-2xl font-bold text-slate-100">TruScope AI</h1>
            </div>
            <nav className="flex flex-col gap-2">
                <button
                    type="button"
                    onClick={() => onNavigate('checker')}
                    className={`flex items-center gap-3 px-4 py-2 rounded-lg font-semibold text-left transition-colors ${
                        currentView === 'checker' 
                        ? 'text-slate-100 bg-slate-700/50' 
                        : 'text-slate-300 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Fact-Checker
                </button>
                <button
                    type="button"
                    onClick={() => onNavigate('history')}
                    className={`flex items-center gap-3 px-4 py-2 rounded-lg font-semibold text-left transition-colors ${
                        currentView === 'history' 
                        ? 'text-slate-100 bg-slate-700/50' 
                        : 'text-slate-300 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                >
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    History
                </button>
                <button
                    type="button"
                    onClick={onSettingsClick}
                    className="flex items-center gap-3 px-4 py-2 text-slate-300 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors text-left font-semibold"
                >
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    Settings
                </button>
            </nav>
            <div className="mt-auto bg-slate-800/50 p-4 rounded-lg">
                <h3 className="font-semibold text-slate-100">Upgrade to Pro</h3>
                <p className="text-sm text-slate-300 mt-1">Unlock advanced features and higher usage limits.</p>
                <button className="w-full mt-4 bg-indigo-600 text-white py-2 rounded-lg font-semibold hover:bg-indigo-500 transition-colors">
                    Upgrade
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;