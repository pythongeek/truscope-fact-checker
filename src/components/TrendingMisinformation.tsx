import React, { useState, useEffect } from 'react';
import { FactDatabase } from '../types/factDatabase';
import { RealTimeFactDBService } from '../services/realTimeFactDB';

interface TrendingMisinformationProps {
  onFactSelect?: (fact: FactDatabase) => void;
}

const TrendingMisinformation: React.FC<TrendingMisinformationProps> = ({ onFactSelect }) => {
  const [trendingFacts, setTrendingFacts] = useState<FactDatabase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    loadTrendingFacts();
  }, []);

  const loadTrendingFacts = async () => {
    setIsLoading(true);
    try {
      const factDB = RealTimeFactDBService.getInstance();
      const trending = await factDB.getTrendingMisinformation(50);
      setTrendingFacts(trending);
    } catch (error) {
      console.error('Failed to load trending misinformation:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getVerdictColor = (verdict: FactDatabase['verdict']) => {
    switch (verdict) {
      case 'false': return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'mostly-false': return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
      case 'mixed': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'mostly-true': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'true': return 'bg-green-500/20 text-green-300 border-green-500/30';
      default: return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
    }
  };

  const getVerdictIcon = (verdict: FactDatabase['verdict']) => {
    switch (verdict) {
      case 'false': return '❌';
      case 'mostly-false': return '⚠️';
      case 'mixed': return '🔄';
      case 'mostly-true': return '✅';
      case 'true': return '✅';
      default: return '❓';
    }
  };

  const filteredFacts = selectedCategory === 'all'
    ? trendingFacts
    : trendingFacts.filter(fact => fact.metadata.category.includes(selectedCategory));

  const categories = ['all', ...Array.from(new Set(trendingFacts.flatMap(f => f.metadata.category)))];

  if (isLoading) {
    return (
      <div className="bg-slate-800/50 p-6 rounded-2xl">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-700 rounded w-1/3"></div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-slate-700/50 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 p-6 rounded-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Trending Misinformation</h2>
          <p className="text-slate-300 text-sm">Monitor and track spreading false claims</p>
        </div>
        <button
          onClick={loadTrendingFacts}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        {categories.map((category: string) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              selectedCategory === category
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {category.charAt(0).toUpperCase() + category.slice(1)}
            {category === 'all' && `(${trendingFacts.length})`}
          </button>
        ))}
      </div>

      {/* Trending Facts List */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {filteredFacts.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <p>No trending misinformation found in this category.</p>
          </div>
        ) : (
          filteredFacts.map((fact) => (
            <div
              key={fact.id}
              className={`p-4 rounded-lg border transition-all hover:scale-[1.02] cursor-pointer ${getVerdictColor(fact.verdict)}`}
              onClick={() => onFactSelect?.(fact)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{getVerdictIcon(fact.verdict)}</span>
                    <span className="text-xs font-semibold uppercase">
                      {fact.verdict.replace('-', ' ')}
                    </span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs text-slate-400">
                      {fact.metadata.topic}
                    </span>
                  </div>

                  <p className="text-sm font-medium line-clamp-2 mb-2">
                    {fact.statement}
                  </p>

                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <span>📊 Score: {Math.round(fact.trends.trendingScore)}</span>
                    <span>💬 Mentions: {fact.trends.mentionCount}</span>
                    <span>🔍 Verified: {fact.verification.verificationCount}x</span>
                    <span>📅 {new Date(fact.verification.lastVerified).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-lg font-bold">
                    {Math.round(fact.confidence * 100)}%
                  </div>
                  <div className="text-xs text-slate-400">Confidence</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Statistics Footer */}
      <div className="border-t border-slate-700 pt-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-red-400">
              {trendingFacts.filter(f => f.verdict === 'false').length}
            </div>
            <div className="text-xs text-slate-400">Completely False</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-orange-400">
              {trendingFacts.filter(f => f.verdict === 'mostly-false').length}
            </div>
            <div className="text-xs text-slate-400">Mostly False</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-yellow-400">
              {trendingFacts.filter(f => f.verdict === 'mixed').length}
            </div>
            <div className="text-xs text-slate-400">Mixed/Disputed</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-400">
              {trendingFacts.reduce((sum, f) => sum + f.trends.mentionCount, 0)}
            </div>
            <div className="text-xs text-slate-400">Total Mentions</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrendingMisinformation;
