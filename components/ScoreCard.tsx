import React from 'react';

interface ScoreCardProps {
  score?: number;
  isLoading?: boolean;
}

const ScoreCardSkeleton: React.FC = () => (
    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 text-center flex flex-col items-center justify-center h-full animate-pulse">
        <div className="h-5 bg-slate-700 rounded w-3/4 mb-4"></div>
        <div className="relative w-40 h-40">
            <div className="w-40 h-40 rounded-full bg-slate-700"></div>
        </div>
    </div>
);

const ScoreCard: React.FC<ScoreCardProps> = ({ score = 0, isLoading = false }) => {
  if (isLoading) {
    return <ScoreCardSkeleton />;
  }

  const getScoreColor = () => {
    if (score >= 75) return 'text-green-400';
    if (score >= 40) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getScoreRingColor = () => {
    if (score >= 75) return 'stroke-green-500';
    if (score >= 40) return 'stroke-yellow-500';
    return 'stroke-red-500';
  };

  const circumference = 2 * Math.PI * 52;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 text-center flex flex-col items-center justify-center h-full animate-fade-in">
      <h3 className="text-lg font-semibold text-slate-100 mb-4">Overall Credibility Score</h3>
      <div className="relative w-40 h-40">
        <svg className="w-full h-full" viewBox="0 0 120 120">
          <circle
            className="stroke-current text-slate-700"
            cx="60"
            cy="60"
            r="52"
            strokeWidth="8"
            fill="transparent"
          />
          <circle
            className={`transform -rotate-90 origin-center transition-all duration-1000 ease-out ${getScoreRingColor()}`}
            cx="60"
            cy="60"
            r="52"
            strokeWidth="8"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
        <div className={`absolute inset-0 flex items-center justify-center text-4xl font-bold ${getScoreColor()}`}>
          {score}
        </div>
      </div>
    </div>
  );
};

export default ScoreCard;