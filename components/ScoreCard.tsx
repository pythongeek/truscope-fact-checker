
import React from 'react';

interface ScoreCardProps {
    score: number;
    label: string;
    description: string;
    scoreSuffix?: string;
    isRisk?: boolean;
}

const getScoreColor = (score: number, isRisk: boolean = false) => {
    // If it's a risk score, lower is better. So we invert for color.
    // If it's a normal score, higher is better.
    const effectiveScore = isRisk ? 100 - score : score;
    if (effectiveScore >= 85) return 'from-green-500 to-emerald-600';
    if (effectiveScore >= 60) return 'from-yellow-500 to-amber-600';
    return 'from-red-500 to-rose-600';
};

export const ScoreCard: React.FC<ScoreCardProps> = ({ score, label, description, scoreSuffix = '', isRisk = false }) => {
    const colorClasses = getScoreColor(score, isRisk);

    return (
        <div className="bg-white p-6 rounded-xl border border-gray-200/80 text-center transition-all duration-300 ease-in-out hover:scale-[1.03] hover:shadow-2xl hover:border-gray-300">
            <div className="text-gray-600 font-semibold mb-2">{label}</div>
            <div className={`text-5xl font-extrabold bg-gradient-to-br ${colorClasses} gradient-text`}>
                {score}
                <span className="text-3xl">{scoreSuffix || '%'}</span>
            </div>
            <div className="mt-3 text-sm text-gray-500">{description}</div>
        </div>
    );
};
