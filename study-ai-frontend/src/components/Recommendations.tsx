'use client';

import ChartSection from '@/components/ChartSection';
import { Clock3, Lightbulb, Target, TrendingUp } from 'lucide-react';

interface RecommendationsProps {
  suggestions: string[];
}

export default function Recommendations({ suggestions }: RecommendationsProps) {
  const defaultRecommendations = [
    'Great job staying focused today!',
    'Try to minimize phone distractions during study sessions.',
    'Consider taking short breaks between study blocks.',
    "You're making excellent progress on your tasks.",
  ];

  const displaySuggestions = suggestions.length > 0 ? suggestions : defaultRecommendations;

  const getIcon = (index: number) => {
    const icons = [Lightbulb, TrendingUp, Clock3, Target];
    const Icon = icons[index % icons.length];
    return <Icon className="h-5 w-5 text-sky-300" />;
  };

  return (
    <ChartSection
      title="Recommendations"
      description="Actionable suggestions designed to reduce distractions and guide your next study block."
      action={<Lightbulb className="h-5 w-5 text-amber-300" />}
    >
      <div className="space-y-3">
        {displaySuggestions.map((suggestion, index) => (
          <div
            key={`${suggestion}-${index}`}
            className="flex items-start gap-3 rounded-[22px] border border-white/10 bg-white/5 p-4 transition-colors duration-300 hover:bg-white/8"
          >
            {getIcon(index)}
            <p className="text-sm leading-6 text-slate-300">{suggestion}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-3xl border border-sky-400/15 bg-[linear-gradient(145deg,rgba(14,165,233,0.14),rgba(15,23,42,0.64))] p-5">
        <h3 className="font-medium text-sky-200">AI Insights</h3>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Based on your study patterns, optimal study times are between 9 AM - 11 AM and 7 PM - 9 PM.
          Consider scheduling your most important tasks during these high-productivity windows.
        </p>
      </div>
    </ChartSection>
  );
}
