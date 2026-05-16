'use client';

import { cn } from '@/lib/utils';

interface ScoreBarProps {
  label: string;
  score: number;
  className?: string;
}

export default function ScoreBar({ label, score, className }: ScoreBarProps) {
  const color = score >= 80 ? 'bg-emerald-500' : score >= 65 ? 'bg-blue-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex justify-between text-sm">
        <span className="text-neutral-600">{label}</span>
        <span className="font-semibold text-neutral-900">{score}</span>
      </div>
      <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700', color)}
          style={{ width: `${Math.min(100, score)}%` }}
        />
      </div>
    </div>
  );
}
