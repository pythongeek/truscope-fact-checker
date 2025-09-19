import React from 'react';
import { Segment } from '../types/factCheck';

interface ColorCodedTextProps {
    segments: Segment[] | undefined;
}

const ColorCodedText: React.FC<ColorCodedTextProps> = ({ segments }) => {
    if (!segments || segments.length === 0) {
        return (
            <div className="bg-slate-800/50 p-6 rounded-2xl text-center">
                <p className="text-slate-300">No text analysis is available for this report.</p>
            </div>
        );
    }

    const getColorClass = (color: Segment['color']) => {
        switch (color) {
            case 'green':
                return 'bg-green-500/20 text-green-300';
            case 'yellow':
                return 'bg-yellow-500/20 text-yellow-300';
            case 'red':
                return 'bg-red-500/20 text-red-300';
            default:
                return 'text-slate-300';
        }
    };

    return (
        <div className="bg-slate-800/50 p-6 rounded-2xl">
            <p className="text-slate-200 leading-relaxed">
                {segments.map((segment, index) => (
                    <span key={index} className={`px-1 py-0.5 rounded-md transition-colors ${getColorClass(segment.color)}`}>
                        {segment.text}
                    </span>
                ))}
            </p>
        </div>
    );
};

export default ColorCodedText;
