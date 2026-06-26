import React, { useEffect, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { GlassCard } from '../ui/GlassCard';
import { ROUND_SUMMARIES } from '../../data/stimuli';
import { motion } from 'framer-motion';

export const InterRoundScreen = () => {
  const { currentRound, score, streak, setPhase } = useGameStore();
  const [countdown, setCountdown] = useState(3);
  const roundData = ROUND_SUMMARIES[currentRound] || ROUND_SUMMARIES[1];

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setPhase('PLAYING');
    }
  }, [countdown, setPhase]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 relative z-10 w-full text-center overflow-hidden bg-cyber-grid bg-[#0d0d1a]">
      {/* Immersive background text */}
      <div className="absolute pointer-events-none opacity-[0.02] text-[20rem] md:text-[30rem] font-display font-black leading-none uppercase whitespace-nowrap top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-cyan-500">
        LEVEL {currentRound}
      </div>

      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-4xl"
      >
        <div className="cyber-clip bg-[#100727] border-2 border-cyan-400 p-10 md:p-16 relative cyber-glow">
           <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-pink-500 to-cyan-400 opacity-80" />
           
           <div className="text-cyan-400 font-bold tracking-[0.3em] font-display text-sm md:text-lg mb-6 uppercase">Level {currentRound} of 5 Initiating</div>
           
           <h2 className="text-4xl md:text-6xl font-black text-white mb-4 font-display cyber-glow-text uppercase tracking-widest">{roundData.name}</h2>

           <div className="mb-6">
             <span className="inline-block text-[11px] md:text-xs font-bold tracking-[0.25em] uppercase text-yellow-300 border border-yellow-400/40 bg-yellow-400/5 px-3 py-1.5 cyber-clip">
               Cue visibility: {roundData.cueVisibility}
             </span>
           </div>

           <p className="text-xl md:text-2xl text-pink-100/80 mb-16 font-medium leading-relaxed font-mono">
             &gt; {roundData.teaser}
           </p>
           
           <div className="grid grid-cols-2 gap-8 mb-16 max-w-2xl mx-auto">
             <div className="bg-black/50 p-6 border-l-4 border-cyan-400 cyber-clip">
                <div className="text-[10px] md:text-xs font-bold tracking-[0.2em] uppercase text-cyan-400/70 mb-2">Current Score</div>
                <div className="text-4xl md:text-5xl font-mono font-black text-white">{score}</div>
             </div>
             <div className="bg-black/50 p-6 border-l-4 border-pink-500 cyber-clip">
                <div className="text-[10px] md:text-xs font-bold tracking-[0.2em] uppercase text-pink-400/70 mb-2">Active Streak</div>
                <div className="text-4xl md:text-5xl font-mono font-black text-pink-500 drop-shadow-md flex items-center justify-center gap-1">
                  {streak}<span className="text-2xl md:text-3xl">×</span>
                  {streak === 0 && <span className="text-base md:text-lg text-pink-500/50 font-mono font-bold uppercase tracking-widest">no streak</span>}
                </div>
             </div>
           </div>

           <div className="text-lg md:text-xl text-cyan-100/60 flex items-center justify-center gap-4 font-bold tracking-[0.2em] uppercase font-display">
             Sequence starts in <span className="font-mono text-5xl md:text-6xl text-yellow-400 ml-2 cyber-glow-text-yellow">{countdown}</span>
           </div>
        </div>
      </motion.div>
    </div>
  );
};
