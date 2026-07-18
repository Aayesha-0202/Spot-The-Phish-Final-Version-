import React, { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../../store/gameStore';
import { ElementId, ClassificationStatus, ClassificationReason } from '../../types';
import { MAX_SCORE } from '../../data/scoring';
import { EFFECT_DURATIONS, StreakMilestone } from '../../data/streak';
import { CheckCircle, AlertTriangle, HelpCircle, X, ArrowRight, Zap, Crosshair, Clock, Flame, Star, Crown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { StimulusCardRenderer } from '../game/StimulusCardRenderer';

const REASONS: ClassificationReason[] = [
  'Fake Sender/Identity',
  'Suspicious Link or URL',
  'Urgency or Pressure Tactic',
  'Request for Sensitive Information',
  'Impersonation or Fake Branding',
  'Other'
];

export const PlayScreen = () => {
  const {
    currentStimuliQueue,
    tutorialQueue,
    currentStimulusIndex,
    currentRound,
    phase,
    score,
    streak,
    streakMultiplier,
    streakMilestone,
    noInvestigationStreak,
    history,
    investigateElement,
    submitInvestigation,
    proceedToNextCard,
    currentInvestigations,
    startGame,
    gameStartTime,
    pausedTimeAccumulator
  } = useGameStore();

  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    if (!gameStartTime) {
      setElapsedTime(0);
      return;
    }
    
    setElapsedTime(Date.now() - gameStartTime - pausedTimeAccumulator);

    const interval = setInterval(() => {
      setElapsedTime(Date.now() - gameStartTime - pausedTimeAccumulator);
    }, 1000);

    return () => clearInterval(interval);
  }, [gameStartTime, pausedTimeAccumulator]);

  const formatElapsedTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isTutorial = phase === 'TUTORIAL' || (phase === 'INVESTIGATION_REVIEW' && currentRound === 0);
  const queue = isTutorial ? tutorialQueue : currentStimuliQueue;
  const currentStimulus = queue[currentStimulusIndex];

  const [selectedElement, setSelectedElement] = useState<ElementId | null>(null);
  const [modalStatus, setModalStatus] = useState<ClassificationStatus | null>(null);

  // Tutorial is interactive: the user learns by doing, nudged by guided prompts.
  const hasInvestigation = Object.keys(currentInvestigations).length > 0;

  // Points awarded on the just-submitted case (exactly +10 when correct) — surfaced in the review.
  const lastScore = history.length ? history[history.length - 1].scoreChange : 0;

  // Streak toast: surfaces a short notification whenever a streak milestone is reached.
  const [streakToast, setStreakToast] = useState<{ count: number; multiplier: number; milestone: StreakMilestone } | null>(null);
  const prevStreakRef = useRef(0);
  useEffect(() => {
    // Fire on every milestone increase (streakMilestone changes when a new tier is hit).
    if (streakMilestone && streak > prevStreakRef.current) {
      const duration = EFFECT_DURATIONS[streakMilestone.effect].toastMs;
      setStreakToast({ count: streak, multiplier: streakMultiplier, milestone: streakMilestone });
      const t = setTimeout(() => setStreakToast(null), duration);
      prevStreakRef.current = streak;
      return () => clearTimeout(t);
    }
    prevStreakRef.current = streak;
  }, [streak, streakMilestone, streakMultiplier]);

  // Flash overlay for visual punch on milestone hits.
  const [flashColor, setFlashColor] = useState<string | null>(null);
  useEffect(() => {
    if (streakMilestone && streak > prevStreakRef.current) {
      const colors: Record<StreakMilestone['effect'], string> = {
        smallFlash: 'from-pink-500/30 to-transparent',
        mediumFlash: 'from-yellow-400/40 to-transparent',
        largeFlash: 'from-cyan-400/50 to-transparent',
        cinematic: 'from-purple-500/60 via-pink-500/40 to-transparent',
      };
      const dur = EFFECT_DURATIONS[streakMilestone.effect].flashMs;
      setFlashColor(colors[streakMilestone.effect]);
      const t = setTimeout(() => setFlashColor(null), dur);
      return () => clearTimeout(t);
    }
  }, [streak, streakMilestone]);

  // "Read carefully" warning: shown after 3 consecutive empty submits, auto-dismisses after 15s.
  const [showReadWarning, setShowReadWarning] = useState(false);
  useEffect(() => {
    if (noInvestigationStreak >= 3) {
      setShowReadWarning(true);
      const t = setTimeout(() => setShowReadWarning(false), 15000);
      return () => clearTimeout(t);
    }
  }, [noInvestigationStreak]);

  // Tutorial highlight: show when in tutorial, no investigation yet, and no element selected
  const showTutorialHighlight = isTutorial && !hasInvestigation && !selectedElement;

  if (!currentStimulus) return null;

  const handleElementClick = (id: ElementId) => {
    if (phase === 'INVESTIGATION_REVIEW') return; // Read-only during review
    // TUTORIAL is now interactive — tapping is allowed so users learn by doing
    setSelectedElement(id);
    setModalStatus(currentInvestigations[id]?.status || null);
  };

  const handleSaveInvestigation = (reasonCode?: ClassificationReason, forcedId?: ElementId, forcedStatus?: ClassificationStatus) => {
    const elId = forcedId || selectedElement;
    const stat = forcedStatus || modalStatus;
    if (elId && stat) {
      investigateElement(elId, {
        status: stat,
        reason: reasonCode
      });
      setSelectedElement(null);
      setModalStatus(null);
    }
  };

  const handleClearInvestigation = () => {
    if (selectedElement) {
      investigateElement(selectedElement, undefined as any);
      setSelectedElement(null);
      setModalStatus(null);
    }
  };

  const onSubmit = () => {
    submitInvestigation();
  };

  return (
    <div className="flex flex-col min-h-screen relative w-full overflow-y-auto bg-cyber-grid bg-[#0d0d1a]">

      {/* Top HUD Bar */}
      <div className="w-full flex justify-between items-start px-4 md:px-8 pt-4 z-40 pointer-events-none">

        {/* Elapsed Timer */}
        <div className="flex items-center gap-3">
           <div className="w-10 h-10 md:w-12 md:h-12 bg-[#1a0f2e] border-2 border-pink-500 rounded-full flex items-center justify-center cyber-glow-pink">
             <Clock className="w-5 h-5 md:w-6 md:h-6 text-pink-500" />
           </div>
           <div className="flex flex-col">
             <span className="text-[13px] uppercase tracking-[0.2em] font-mono text-pink-400 font-bold leading-none mb-1">Time Elapsed</span>
             <span className="text-white font-mono font-black text-lg md:text-xl leading-none">{formatElapsedTime(elapsedTime)}</span>
           </div>
        </div>

        {/* Center Level / Round Indicator */}
        <div className="flex flex-col items-center">
          <div className="cyber-clip bg-[#100727] border-2 border-yellow-400 px-6 py-2 cyber-glow-yellow relative text-center">
            <span className="text-yellow-400 font-display font-black tracking-widest text-lg md:text-xl uppercase block leading-none">
              {isTutorial ? 'PRACTICE' : `LEVEL ${currentRound} OF 5`}
            </span>
            {isTutorial ? (
              <span className="block text-pink-300/70 text-[12px] mt-1 font-mono tracking-[0.2em] uppercase">Follow the guided prompts</span>
            ) : (
              <span className="block text-cyan-300/70 text-[12px] mt-1 font-mono tracking-[0.2em] uppercase">Case {currentStimulusIndex + 1} of {queue.length}</span>
            )}
          </div>
          <div className="text-cyan-400 text-[12px] mt-2 uppercase tracking-[0.3em] font-bold">
            {phase === 'INVESTIGATION_REVIEW' ? 'Review Phase' : 'Active Investigation'}
          </div>
          {isTutorial && (
             <button onClick={startGame} className="mt-2 text-cyan-400 hover:text-cyan-300 text-xs font-mono uppercase border border-cyan-500/30 px-3 py-1 bg-cyan-950/30 hover:bg-cyan-900/50 transition-colors pointer-events-auto">
               Skip Tutorial {'>'}
             </button>
          )}
        </div>

        {/* Score Bar */}
        <div className="flex items-center gap-3">
           {/* Multiplier badge */}
           {streakMultiplier > 1 && (
             <div className="cyber-clip bg-yellow-500/20 border border-yellow-400 px-3 py-1 text-yellow-300 text-xs font-mono font-bold tracking-wider">
               {streakMultiplier.toFixed(2)}×
             </div>
           )}
           <div className="flex md:hidden flex-col items-end gap-1.5">
              <div className="flex justify-between items-baseline">
                <span className="text-cyan-300 text-lg font-mono font-black tabular-nums leading-none">{score}</span>
                <span className="text-cyan-400 text-[11px] uppercase tracking-[0.25em] font-bold ml-2">PTS</span>
              </div>
           </div>
           <div className="hidden md:flex flex-col items-end gap-1.5">
             <div className="flex justify-between items-baseline w-60">
               <span className="text-cyan-300 text-xl font-mono font-black tabular-nums leading-none">{score}</span>
               <span className="text-cyan-400 text-[13px] uppercase tracking-[0.25em] font-bold">Score</span>
             </div>
             <div className="w-60 h-4 bg-[#1a0f2e] border border-cyan-500/50 p-[3px] cyber-clip">
               <div className="h-full bg-gradient-to-r from-cyan-500 to-cyan-300 transition-all duration-700 ease-out" style={{ width: `${Math.min(100, Math.max(0, (score / MAX_SCORE) * 100))}%` }} />
             </div>
           </div>
           <div className="w-10 h-10 md:w-12 md:h-12 bg-[#1a0f2e] border-2 border-cyan-400 rounded-full flex items-center justify-center cyber-glow">
             <Zap className="w-5 h-5 text-cyan-400" fill="currentColor" />
           </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:flex-row items-center justify-center lg:items-start lg:justify-center relative z-30 w-full max-w-7xl mx-auto pt-4 pb-6 px-4 gap-6">

        {/* Left Side: Phone Frame */}
        <div className="w-full lg:w-1/2 flex flex-col items-center lg:items-end justify-center relative pointer-events-auto">
          <div className="relative border-4 border-slate-700 rounded-[2rem] overflow-hidden shadow-2xl bg-black w-full max-w-[290px] aspect-[3/5] flex flex-col shrink-0">
             <StimulusCardRenderer
                stimulus={currentStimulus}
                onElementClick={handleElementClick}
                investigations={currentInvestigations}
                showResults={phase === 'INVESTIGATION_REVIEW'}
                tutorialHighlightSender={showTutorialHighlight}
              />
          </div>

          {/* Tutorial tooltip — points to the sender name */}
          <AnimatePresence>
            {showTutorialHighlight && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="absolute top-[52px] left-1/2 -translate-x-1/2 z-50 pointer-events-none"
              >
                <div className="relative">
                  <div className="bg-[#0d0d1a] border-2 border-cyan-400 rounded-lg px-3 py-2 shadow-[0_0_15px_rgba(6,182,212,0.4)] max-w-[200px]">
                    <p className="text-cyan-300 text-[13px] font-mono font-bold uppercase tracking-wider text-center leading-tight">
                      Tap this sender name here
                    </p>
                  </div>
                  {/* Arrow pointing down */}
                  <div className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-cyan-400" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main Action Button */}
          <div className="mt-4 w-full max-w-[290px] pointer-events-auto">
             {phase === 'INVESTIGATION_REVIEW' ? (
               <button
                 onClick={proceedToNextCard}
                  className="w-full py-4 px-8 cyber-clip bg-cyan-400 text-black text-xl tracking-[0.2em] font-display uppercase font-black hover:bg-cyan-300 transition-all cyber-glow flex justify-center items-center gap-3 group/btn animate-pulse"
               >
                  {isTutorial ? 'FINISH PRACTICE' : 'CONTINUE'} <ArrowRight className="w-6 h-6 -ml-1 group-hover/btn:translate-x-1 transition-transform" />
               </button>
             ) : phase === 'TUTORIAL' ? (
               hasInvestigation && !selectedElement ? (
                 <button
                   onClick={onSubmit}
                   className="w-full py-4 cyber-clip bg-yellow-400 text-black text-xl tracking-[0.2em] font-display uppercase font-black hover:bg-yellow-300 transition-all cyber-glow-yellow flex justify-center items-center gap-3 group/btn"
                 >
                   SUBMIT <Crosshair className="w-6 h-6 fill-black group-hover/btn:scale-110 transition-transform" />
                 </button>
               ) : (
                 <div className="w-full py-4 text-center text-[13px] uppercase tracking-widest text-slate-500 font-mono border border-dashed border-slate-700 cyber-clip">
                   {selectedElement ? 'Choose a classification →' : 'Tap an element on the phone to begin'}
                 </div>
               )
             ) : (
               <button
                 onClick={onSubmit}
                 className="w-full py-4 cyber-clip bg-yellow-400 text-black text-xl tracking-[0.2em] font-display uppercase font-black hover:bg-yellow-300 transition-all cyber-glow-yellow flex justify-center items-center gap-3 group/btn"
               >
                 SUBMIT <Crosshair className="w-6 h-6 fill-black group-hover/btn:scale-110 transition-transform" />
               </button>
             )}
          </div>
        </div>

        {/* Right Side: Investigation Popup or Report */}
        <div className="w-full lg:w-1/2 max-w-[400px] flex flex-col justify-start pointer-events-auto">

          {phase === 'INVESTIGATION_REVIEW' ? (
              <div className="cyber-clip-lg bg-[#100727] border-2 border-cyan-500/50 p-8 cyber-glow relative space-y-4">
                 <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-400 to-transparent" />
                 <h3 className="font-display font-black text-3xl md:text-4xl text-cyan-400 uppercase tracking-widest">{isTutorial ? 'Practice Complete' : 'Case Closed'}</h3>
                 {isTutorial ? (
                   <p className="text-pink-300/80 text-xs font-mono uppercase tracking-widest border border-pink-500/30 bg-pink-500/5 px-3 py-1.5">
                     ✓ That's the workflow — the real investigation begins next.
                   </p>
                  ) : (
                    <span className={`inline-block text-sm font-black uppercase tracking-widest px-4 py-1.5 cyber-clip border ${
                      lastScore > 0
                        ? 'text-green-400 border-green-500/40 bg-green-500/10'
                        : lastScore < 0
                          ? 'text-red-400 border-red-500/40 bg-red-500/10'
                          : 'text-slate-400 border-slate-600 bg-slate-700/20'
                    }`}>
                      {lastScore > 0 ? `+${lastScore} PTS · CORRECT READ` : lastScore < 0 ? `${lastScore} PTS · WRONG CALL` : `0 PTS · NO CREDIT`}
                    </span>
                  )}
                 <p className="text-cyan-100 text-base leading-relaxed bg-cyan-950/50 p-5 border-l-4 border-cyan-400 font-mono shadow-inner shadow-cyan-900/50">
                   {currentStimulus.explanation}
                 </p>
 
                 <h4 className="font-bold text-pink-400 uppercase tracking-[0.2em] text-xs">Indicator Breakdown</h4>
                 <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                   {(['sender', 'content', 'actionUrl', 'actionText', 'amount'] as ElementId[]).map(id => {
                      const trueEl = (currentStimulus as any)[id];
                      if (!trueEl) return null;
                      const inv = currentInvestigations[id];
 
                      return (
                        <div key={id} className="bg-black/40 p-4 border border-slate-800 space-y-2">
                           <div className="flex items-start justify-between gap-2">
                             <span className="font-mono text-xs md:text-sm font-bold text-slate-400 shrink-0 uppercase">{id}</span>
                             {trueEl.isSuspicious ? (
                               <span className="text-red-400 text-xs font-black px-2 py-0.5 bg-red-400/10 border border-red-500/30 uppercase">Threat</span>
                             ) : (
                               <span className="text-green-400 text-xs font-black px-2 py-0.5 bg-green-400/10 border border-green-500/30 uppercase">Clean</span>
                             )}
                           </div>
                           <p className="text-slate-200 text-sm md:text-base font-medium">"{trueEl.text}"</p>
                           <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between">
                             <span className="text-xs uppercase text-slate-500 font-mono">User Log:</span>
                             <span className={`text-xs font-black uppercase ${!inv ? 'text-slate-600' : inv.status === 'SUSPICIOUS' ? 'text-red-400' : inv.status === 'SAFE' ? 'text-green-400' : 'text-yellow-400'}`}>
                               {inv ? inv.status : 'IGNORED'}
                             </span>
                           </div>
                        </div>
                      );
                   })}
                 </div>
              </div>
          ) : selectedElement ? (
            <div className="cyber-clip-lg bg-[#180a0a] border-2 border-yellow-400 p-6 cyber-glow-yellow relative">
               {/* Warning Header */}
               <div className="bg-yellow-400 text-black font-display font-black tracking-[0.2em] uppercase text-center py-1 -mx-6 -mt-6 mb-4 cyber-clip flex justify-center items-center gap-2">
                 <AlertTriangle className="w-5 h-5 fill-black" /> WARNING: ANALYZE <AlertTriangle className="w-5 h-5 fill-black" />
               </div>

               {isTutorial && (
                 <p className="text-[13px] text-pink-300/80 font-mono mb-4 bg-pink-500/5 border border-pink-500/20 p-2">
                   <span className="font-bold">Guided:</span> this sender is legitimate — choose <span className="text-green-400 font-bold">Clean</span>, then tap Log Data.
                 </p>
               )}

               <div className="flex justify-between items-center mb-4">
                 <h3 className="font-display font-bold text-lg text-white uppercase tracking-widest">Select Classification</h3>
                 <button onClick={() => setSelectedElement(null)} className="text-yellow-400 hover:text-white p-1 bg-yellow-400/10 rounded">
                   <X className="w-5 h-5"/>
                 </button>
               </div>

               <p className="text-xs text-yellow-100/60 mb-6 font-mono bg-black/40 p-2 border border-yellow-400/20 break-all">
                 <span className="text-yellow-400">Target:</span> {(currentStimulus as any)[selectedElement]?.text}
               </p>

               <div className="space-y-3 mb-6">
                  <button
                     onClick={() => setModalStatus('SAFE')}
                     className={`w-full py-3 px-4 cyber-clip flex items-center gap-3 font-display uppercase font-bold tracking-widest transition-all border
                       ${modalStatus === 'SAFE' ? 'bg-green-500/20 border-green-500 text-green-400 cyber-glow' : 'bg-black/40 border-slate-700 hover:border-green-500/50 text-white hover:text-green-400'}`}
                  >
                     <CheckCircle className="w-5 h-5" /> Clean
                  </button>
                  <button
                     onClick={() => setModalStatus('SUSPICIOUS')}
                     className={`w-full py-3 px-4 cyber-clip flex items-center gap-3 font-display uppercase font-bold tracking-widest transition-all border
                       ${modalStatus === 'SUSPICIOUS' ? 'bg-red-500/20 border-red-500 text-red-400 cyber-glow-pink' : 'bg-black/40 border-slate-700 hover:border-red-500/50 text-white hover:text-red-400'}`}
                  >
                     <AlertTriangle className="w-5 h-5" /> Threat
                  </button>
                  <button
                     onClick={() => setModalStatus('NOT_SURE')}
                     className={`w-full py-3 px-4 cyber-clip flex items-center gap-3 font-display uppercase font-bold tracking-widest transition-all border
                       ${modalStatus === 'NOT_SURE' ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400 cyber-glow-yellow' : 'bg-black/40 border-slate-700 hover:border-yellow-500/50 text-white hover:text-yellow-400'}`}
                  >
                     <HelpCircle className="w-5 h-5" /> Unknown
                  </button>
               </div>

               {modalStatus === 'SUSPICIOUS' && (
                  <div className="mb-6 animate-in fade-in">
                    <p className="text-[12px] font-bold text-yellow-400 uppercase mb-2 tracking-[0.2em]">Select Vector</p>
                    <select
                       className="w-full bg-black/60 border border-yellow-400/50 text-white p-3 text-sm font-mono focus:border-yellow-400 outline-none cyber-clip"
                       onChange={(e) => handleSaveInvestigation(e.target.value as ClassificationReason)}
                       defaultValue=""
                    >
                       <option value="" disabled>Awaiting selection...</option>
                       {REASONS.map(r => (
                         <option key={r} value={r}>{r}</option>
                       ))}
                    </select>
                  </div>
               )}

               {modalStatus !== 'SUSPICIOUS' && (
                 <button
                   onClick={() => handleSaveInvestigation()}
                   disabled={!modalStatus}
                   className="w-full bg-yellow-400 hover:bg-yellow-300 disabled:opacity-30 disabled:bg-slate-600 text-black font-display font-black tracking-widest uppercase py-3 cyber-clip transition-colors"
                 >
                   Log Data
                 </button>
               )}

               {currentInvestigations[selectedElement] && (
                 <button onClick={handleClearInvestigation} className="mt-4 text-[12px] uppercase tracking-widest text-slate-500 hover:text-red-400 w-full text-center font-bold">
                   Purge Selection
                 </button>
               )}
            </div>
          ) : isTutorial ? (
             /* Guided practice prompt — replaces the passive auto-play tutorial */
             <div className="cyber-clip-lg bg-[#100727] border-2 border-pink-500/50 p-6 cyber-glow-pink relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pink-500 to-transparent" />
                <div className="mb-4">
                  <span className="text-[12px] font-black uppercase tracking-[0.3em] text-pink-400 border border-pink-500/40 px-2 py-1">Practice Round</span>
                </div>
                <h3 className="font-display font-black text-2xl text-white mb-3 uppercase tracking-widest">
                  {hasInvestigation ? 'Lock it in' : 'Tap to investigate'}
                </h3>
                <p className="text-cyan-100/80 text-sm leading-relaxed font-mono mb-4">
                  {hasInvestigation
                    ? 'Nice work. Now press SUBMIT below to score this case and see how the investigation review works.'
                    : 'This is a safe bank SMS. Tap the sender name on the phone to open the investigation panel — the same action you\'ll use on every real case.'}
                </p>
                <div className="flex items-start gap-2 text-[13px] text-yellow-300/80 font-mono bg-yellow-400/5 border border-yellow-400/20 p-3">
                   <Zap className="w-4 h-4 shrink-0 mt-0.5" /> Practice rounds don't affect your score.
                </div>
             </div>
          ) : (
             <div className="cyber-clip-lg bg-[#100727]/50 border border-cyan-500/20 p-8 h-48 flex flex-col items-center justify-center text-center">
               <Crosshair className="w-10 h-10 text-cyan-500/30 mb-4 animate-pulse" />
               <p className="text-cyan-100/40 text-sm font-mono uppercase tracking-widest">Awaiting target selection on device interface...</p>
             </div>
          )}

        </div>

      </div>

      {/* Flash overlay — full-screen radial burst on milestone hit */}
      <AnimatePresence>
        {flashColor && (
          <motion.div
            key="streak-flash"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={`fixed inset-0 z-50 pointer-events-none bg-gradient-radial ${flashColor}`}
            style={{ background: `radial-gradient(circle at center, ${flashColor.includes('purple') ? 'rgba(168,85,247,0.35)' : flashColor.includes('cyan') ? 'rgba(34,211,238,0.3)' : flashColor.includes('yellow') ? 'rgba(250,204,21,0.3)' : 'rgba(236,72,153,0.25)'} 0%, transparent 70%)` }}
          />
        )}
      </AnimatePresence>

      {/* Streak notification — slides in on the right when a milestone is reached */}
      <AnimatePresence>
        {streakToast !== null && (
          <motion.div
            key={streakToast.count}
            initial={{ x: 160, opacity: 0, scale: 0.85 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            exit={{ x: 160, opacity: 0, scale: 0.85 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            className="fixed right-2 md:right-8 top-1/2 -translate-y-1/2 z-50 pointer-events-none max-w-[200px] md:max-w-none"
          >
            <div className="cyber-clip bg-[#100727] border-2 border-pink-500 px-5 py-4 cyber-glow-pink flex items-center gap-3 shadow-2xl">
              {streakToast.milestone.effect === 'cinematic' ? (
                <Crown className="w-8 h-8 text-yellow-400 fill-yellow-400/40" />
              ) : streakToast.milestone.effect === 'largeFlash' ? (
                <Star className="w-7 h-7 text-cyan-400 fill-cyan-400/40" />
              ) : streakToast.milestone.effect === 'mediumFlash' ? (
                <Star className="w-7 h-7 text-yellow-300 fill-yellow-300/40" />
              ) : (
                <Flame className="w-7 h-7 text-pink-500 fill-pink-500/40 animate-pulse" />
              )}
              <div className="text-left">
                <div className="text-[11px] uppercase tracking-[0.25em] text-pink-300/70 font-bold font-mono">
                  {streakToast.milestone.message}
                </div>
                <div className="text-2xl font-black text-white font-display tracking-wider leading-none mt-1">
                  🔥 {streakToast.count}× <span className="text-pink-500">{streakToast.multiplier.toFixed(2)}×</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* "Read carefully" warning — appears after 3 consecutive empty submits */}
      <AnimatePresence>
        {showReadWarning && (
          <motion.div
            key="read-warning"
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
          >
            <div className="bg-red-950/90 border-2 border-red-500 px-4 md:px-8 py-3 md:py-4 cyber-clip shadow-2xl flex items-center gap-3 md:gap-4 max-w-[90vw] md:max-w-none">
              <AlertTriangle className="w-6 h-6 md:w-8 md:h-8 text-red-400 shrink-0" />
              <div>
                <div className="text-red-300 font-display font-black text-sm md:text-lg uppercase tracking-widest">Read carefully before answering.</div>
                <div className="text-red-400/60 text-xs font-mono mt-1">Select elements and classify them — don't just click Submit.</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};
