import React from 'react';
import { cn } from './Button';

export const GlassCard = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { strong?: boolean }>(
  ({ className, strong, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-3xl shadow-xl',
          strong ? 'glass-strong' : 'glass',
          className
        )}
        {...props}
      />
    );
  }
);
GlassCard.displayName = 'GlassCard';

export const HUD = ({ lives, streak, score }: { lives: number, streak: number, score: number }) => {
  return (
    <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-50 pointer-events-none">
      <div className="flex gap-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={cn("text-2xl transition-all", i < lives ? "text-red-500" : "text-white/20 scale-75")}>
            ❤️
          </div>
        ))}
      </div>
      
      <div className="flex items-center gap-4">
        {streak > 2 && (
          <div className="animate-pulse font-bold text-yellow-300 text-sm tracking-widest uppercase">
            {streak}x Streak!
          </div>
        )}
        <GlassCard className="px-4 py-2 font-mono font-bold text-xl flex items-center gap-2">
          <span>{score}</span>
          <span className="text-white/50 text-sm">PTS</span>
        </GlassCard>
      </div>
    </div>
  );
};
