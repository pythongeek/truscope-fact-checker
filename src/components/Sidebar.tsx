import React from 'react';
import { ShieldCheckIcon } from './icons';

interface SidebarProps {
    onSettingsClick: () => void;
    currentView: 'checker' | 'history' | 'trending' | 'optimizer';
    onNavigate: (view: 'checker' | 'history' | 'trending' | 'optimizer') => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onSettingsClick, currentView, onNavigate }) => {
    return (
        <aside className="w-64 bg-slate-900/70 backdrop-blur-lg p-6 border-r border-slate-800 flex-shrink-0 hidden md:flex flex-col">
            <div className="flex items-center gap-3 mb-10">
                <ShieldCheckIcon className="w-8 h-8 text-indigo-400" />
                <h1 className="text-2xl font-bold text-slate-100">Truscope Fact Checker By Nion</h1>
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
                    onClick={() => onNavigate('trending')}
                    className={`flex items-center gap-3 px-4 py-2 rounded-lg font-semibold text-left transition-colors ${
                        currentView === 'trending'
                        ? 'text-slate-100 bg-slate-700/50'
                        : 'text-slate-300 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                >
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7.014A8.003 8.003 0 0112 3c1.398 0 2.743.57 3.657 1.514C18.343 6.229 19 8.828 19 11c0 3-1.5 5-2.343 4.657z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14a3 3 0 100-6 3 3 0 000 6z" /></svg>
                    Trending
                </button>
                <button
                    type="button"
                    onClick={() => onNavigate('optimizer')}
                    className={`flex items-center gap-3 px-4 py-2 rounded-lg font-semibold text-left transition-colors ${
                        currentView === 'optimizer'
                        ? 'text-slate-100 bg-slate-700/50'
                        : 'text-slate-300 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    Content Optimizer
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