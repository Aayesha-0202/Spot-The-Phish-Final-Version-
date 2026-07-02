import React, { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useAuthStore } from '../../store/authStore';
import { Crosshair, Play, ArrowRight, Zap, AlertTriangle, Search, Info, X, Mail, User, HelpCircle, SkipForward } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import logoUrl from '../../assets/ZeTheta logo.jpg';

const CONSENT_ITEMS = [
  { key: 'dpdp', label: 'Acknowledge DPDP Privacy Act' },
  { key: 'record', label: 'Enable Assessment Telemetry' },
  { key: 'academic', label: 'Confirm Solo Operation' },
] as const;

const CONSENT_DETAILS: Record<string, string> = {
  dpdp: 'Your data is handled in line with the DPDP Act, 2023. Only your game responses are recorded for research — no personal messages are ever stored.',
  record: 'We log anonymous interaction data (clicks, timing, score) to improve the training. The contents you read during play are never stored.',
  academic: 'This is a solo assessment. Please complete it on your own so your results reflect your personal judgement.',
};

export const LobbyScreen = () => {
  const { startTutorial, startGame, playerName, setPlayerName, playerEmail, setPlayerEmail } = useGameStore();
  const { isAuthenticated, isGuest, user } = useAuthStore();
  const [agreed, setAgreed] = useState({
    dpdp: false,
    record: false,
    academic: false
  });
  const [openInfo, setOpenInfo] = useState<string | null>(null);
  const [showIntro, setShowIntro] = useState(false);
  const [showWhy, setShowWhy] = useState(false);

  // Optional email → persisted to the backend so the report can be auto-emailed.
  const [linkEmail, setLinkEmail] = useState(false);
  const emailValid = !playerEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(playerEmail);

  const codenameValid = playerName.trim().length > 0;
  const allAgreed = agreed.dpdp && agreed.record && agreed.academic && codenameValid;
  const remainingCount = (agreed.dpdp ? 0 : 1) + (agreed.record ? 0 : 1) + (agreed.academic ? 0 : 1) + (codenameValid ? 0 : 1);

  const handlePlayClick = () => {
    setShowIntro(true);
  };

  return (
    <div className="flex flex-col min-h-screen relative z-10 w-full items-center justify-center py-12 px-6 md:px-12 lg:px-24 gap-10 overflow-y-auto w-full mx-auto bg-cyber-grid">

      <div className="absolute top-0 w-full h-2 bg-gradient-to-r from-pink-500 via-cyan-400 to-yellow-400 opacity-80" />

      {/* Brand logo — top-left corner of the landing screen */}
      <div className="absolute top-5 left-5 md:top-8 md:left-10 z-20" aria-label="Spot the Phish logo">
        <img src={logoUrl} alt="ZeTheta Logo" className="w-32 h-32 md:w-48 md:h-48 object-contain" />
      </div>

      <AnimatePresence mode="wait">
        {!showIntro ? (
          <motion.div key="lobby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -20 }} className="w-full flex flex-col items-center">
            <motion.div initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="w-full max-w-4xl flex flex-col items-center text-center">

              <div className="flex items-center gap-2 opacity-90 mb-6 border-b-2 border-cyan-400 px-6 py-2 uppercase tracking-[0.3em] text-xs font-black text-cyan-300 font-display">
                <img src={logoUrl} alt="" className="w-6 h-6 object-contain" />
                Neural Assessment Module
              </div>

              {/* Game title now occupies the former logo position (no duplicate title) */}
              <div className="mb-8 w-full flex flex-col items-center justify-center">
                <h1 className="text-7xl md:text-8xl font-black text-yellow-400 font-display italic tracking-tight cyber-glow-text-yellow flex flex-col md:flex-row items-center justify-center gap-4 uppercase">
                  <span>Spot</span>
                  <span className="text-white cyber-glow-text">The</span>
                  <span className="text-pink-500 cyber-glow-text-pink">Phish</span>
                </h1>
                <div className="text-2xl md:text-3xl font-display text-white mt-2 tracking-[0.2em] uppercase font-bold opacity-90">
                  Cyber Investigation GUI
                </div>
              </div>

              <div className="text-lg md:text-xl text-cyan-100/70 mb-10 max-w-2xl font-medium tracking-wide">
                Initialize sequence to analyze network anomalies. Detect deceptive elements across 5 security tiers.
              </div>

              {/* Player profile — guest by default, optional email to receive the report */}
              <div className="w-full max-w-lg mb-6">
                <div className="cyber-clip bg-[#0d0d1a]/60 border border-cyan-500/30 p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <User className="w-5 h-5 text-cyan-400" />
                    <span className="text-sm font-bold text-white uppercase tracking-widest font-display">Player Profile</span>
                  </div>
                  <div className="flex flex-col gap-3">
                    <input
                      value={playerName}
                      onChange={e => setPlayerName(e.target.value)}
                      placeholder="Codename *"
                      className="w-full bg-black/50 border border-cyan-500/40 text-white placeholder-slate-500 p-3 text-sm font-mono focus:border-cyan-400 outline-none cyber-clip"
                    />
                    {!codenameValid && (
                      <p className="text-yellow-400 text-[10px] mt-1 font-mono">A codename is required to start the game.</p>
                    )}
                    <button
                      type="button"
                      onClick={() => setLinkEmail(v => !v)}
                      className="flex items-center gap-2 text-xs uppercase tracking-widest text-pink-300/80 hover:text-pink-200 font-bold transition-colors self-start"
                    >
                      <Mail className="w-4 h-4" /> {linkEmail ? 'Email linked ✓ (tap to hide)' : 'Link email to receive my report'}
                    </button>
                    <AnimatePresence>
                      {linkEmail && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <input
                            value={playerEmail}
                            onChange={e => setPlayerEmail(e.target.value)}
                            type="email"
                            placeholder="you@email.com"
                            className={`w-full bg-black/50 border text-white placeholder-slate-500 p-3 text-sm font-mono focus:outline-none cyber-clip ${
                              emailValid ? 'border-pink-500/40 focus:border-pink-400' : 'border-red-500/60'
                            }`}
                          />
                          {!emailValid && (
                            <p className="text-red-400 text-[10px] mt-1 font-mono">Please enter a valid email address.</p>
                          )}
                          {emailValid && playerEmail && (
                            <p className="text-green-300/80 text-[10px] mt-2 font-mono leading-relaxed">
                              ✉️ Your personalized report will be emailed to you after you complete the assessment.
                            </p>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <p className="mt-3 text-[10px] uppercase tracking-widest text-slate-500 font-mono">
                    {isAuthenticated
                      ? `Signed in as ${user?.email || user?.username || 'Unknown'} — scores count on the leaderboard`
                      : isGuest
                        ? 'Playing as Guest — sign up to rank on the leaderboard'
                        : 'Playing as Guest — no password or account needed'}
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }} className="w-full max-w-lg">
              <div className="cyber-clip bg-[#0d0d1a] border-2 border-pink-500/50 p-8 md:p-10 relative overflow-hidden group">

                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pink-500 to-transparent opacity-50" />
                <div className="absolute top-0 right-0 w-16 h-16 bg-pink-500/10 blur-xl" />

                <div className="flex items-center gap-3 mb-2">
                  <Crosshair className="w-6 h-6 text-pink-500" />
                  <span className="text-xl font-bold text-white uppercase tracking-widest font-display">Access Protocols</span>
                </div>

                {/* Explicit instruction so users know exactly what to do */}
                <p className="text-[11px] md:text-xs text-pink-200/60 mb-5 uppercase tracking-[0.2em] font-bold flex items-center gap-2">
                  <Crosshair className="w-3.5 h-3.5" /> Confirm all 3 protocols below to unlock PLAY
                </p>

                <div className="w-full space-y-3 mb-8 font-mono">
                  {CONSENT_ITEMS.map(item => {
                    const key = item.key;
                    const checked = agreed[key];
                    return (
                      <div key={key} className="rounded transition-colors">
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-4 cursor-pointer group/label hover:bg-white/5 p-3 rounded transition-colors flex-1">
                            <div className="relative flex items-center justify-center shrink-0">
                              <input type="checkbox" className="peer appearance-none w-5 h-5 rounded-none border border-cyan-500/50 checked:bg-cyan-500 checked:border-cyan-400 transition-colors cursor-pointer cyber-clip" checked={checked} onChange={e => setAgreed(a => ({ ...a, [key]: e.target.checked }))} />
                              <svg className="absolute w-3 h-3 text-black opacity-0 peer-checked:opacity-100 pointer-events-none" viewBox="0 0 14 10" fill="none"><path d="M1 5L5 9L13 1" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" strokeLinejoin="miter" /></svg>
                            </div>
                            <span className="text-sm md:text-base text-cyan-100/70 group-hover/label:text-cyan-100 transition-colors uppercase tracking-wider">{item.label}</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => setOpenInfo(openInfo === key ? null : key)}
                            aria-label={`More info about ${item.label}`}
                            className="shrink-0 p-2 text-cyan-400/70 hover:text-cyan-300 hover:bg-cyan-500/10 rounded transition-colors"
                          >
                            <Info className={`w-4 h-4 transition-transform ${openInfo === key ? 'rotate-90' : ''}`} />
                          </button>
                        </div>
                        <AnimatePresence>
                          {openInfo === key && (
                            <motion.p
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden text-[11px] md:text-xs text-cyan-200/60 leading-relaxed px-3 pb-2 font-mono normal-case tracking-normal"
                            >
                              {CONSENT_DETAILS[key]}
                            </motion.p>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>

                {/* CTA stays disabled + greyed until every mandatory condition is met, with a hover tooltip explaining why */}
                <div className="relative group w-full">
                  <button
                    disabled={!allAgreed}
                    onClick={handlePlayClick}
                    className="w-full py-4 cyber-clip bg-yellow-400 text-black text-2xl tracking-[0.2em] font-display uppercase font-black disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500 hover:bg-yellow-300 transition-all cyber-glow-yellow flex justify-center items-center gap-3 group/btn"
                  >
                    PLAY <Play className="w-6 h-6 fill-black group-hover/btn:translate-x-1 transition-transform" />
                  </button>
                  {!allAgreed && (
                    <>
                      <div className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-[#0d0d1a] border border-yellow-400/50 px-3 py-2 text-[10px] uppercase tracking-widest text-yellow-300 whitespace-nowrap cyber-clip z-20 shadow-lg">
                        🔒 {remainingCount} protocol{remainingCount > 1 ? 's' : ''} left to confirm
                        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#0d0d1a] border-r border-b border-yellow-400/50 rotate-45" />
                      </div>
                      <p className="mt-3 text-center text-[10px] uppercase tracking-widest text-slate-500 font-mono">Play unlocks when all protocols are confirmed</p>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setShowWhy(true)}
                  className="mt-5 mx-auto flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-cyan-300/70 hover:text-cyan-200 font-bold transition-colors"
                >
                  <HelpCircle className="w-4 h-4" /> Why am I playing this game?
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div key="intro" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-3xl flex flex-col gap-6">

            {/* Clear heading to set expectations before the steps */}
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center">
              <div className="inline-flex items-center gap-2 border-b-2 border-cyan-400 px-4 py-1 uppercase tracking-[0.3em] text-[10px] font-black text-cyan-300 font-display mb-4">
                <Search className="w-3.5 h-3.5" /> Mission Briefing
              </div>
              <h2 className="text-3xl md:text-5xl font-display font-black text-white uppercase tracking-widest cyber-glow-text">How To Play</h2>
              <p className="text-cyan-100/60 mt-3 text-sm md:text-base font-mono max-w-xl mx-auto">A 3-step workflow you'll repeat on every case. Review the brief, then run a short guided practice round before the real investigation begins.</p>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="cyber-clip bg-[#0d0d1a] border border-cyan-500/50 p-6 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-cyan-500/20 rounded-full shrink-0">
                  <Search className="w-8 h-8 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-cyan-300 uppercase tracking-widest font-display mb-2">1. Analyze Evidence</h3>
                  <p className="text-cyan-100/80 leading-relaxed font-mono text-sm md:text-base">
                    You will be presented with digital communications (Emails, SMS, WhatsApp, UPI, Social Media). Click on key elements like senders, links, or content to investigate them.
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }} className="cyber-clip bg-[#0d0d1a] border border-yellow-500/50 p-6 shadow-[0_0_15px_rgba(234,179,8,0.2)]">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-yellow-500/20 rounded-full shrink-0">
                  <AlertTriangle className="w-8 h-8 text-yellow-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-yellow-400 uppercase tracking-widest font-display mb-2">2. Classify Threats</h3>
                  <p className="text-yellow-100/80 leading-relaxed font-mono text-sm md:text-base">
                    Determine if the highlighted element is SAFE or SUSPICIOUS. If suspicious, select the primary reason for your classification (e.g., Fake Domain, Urgency, Malicious Link).
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.7 }} className="cyber-clip bg-[#0d0d1a] border border-pink-500/50 p-6 shadow-[0_0_15px_rgba(236,72,153,0.2)]">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-pink-500/20 rounded-full shrink-0">
                  <Zap className="w-8 h-8 text-pink-500" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-pink-500 uppercase tracking-widest font-display mb-2">3. Earn Points &amp; Survive</h3>
                  <p className="text-pink-100/80 leading-relaxed font-mono text-sm md:text-base">
                    Correctly identifying threats earns you points toward your score. Missing obvious scams or falsely accusing legitimate messages will cost you one of your 3 lives. Lose all 3, and your investigation ends.
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 }}
              className="flex flex-col md:flex-row gap-4"
            >
              <motion.button
                onClick={startTutorial}
                className="flex-1 py-4 cyber-clip bg-cyan-500 text-black text-xl md:text-2xl tracking-[0.2em] font-display uppercase font-black hover:bg-cyan-400 transition-all cyber-glow flex justify-center items-center gap-3 group/btn"
              >
                Start Tutorial <ArrowRight className="w-6 h-6 fill-black group-hover/btn:translate-x-1 transition-transform" />
              </motion.button>
              <button
                onClick={startGame}
                className="md:w-auto flex items-center justify-center gap-2 px-6 py-4 cyber-clip border-2 border-slate-600 text-slate-300 hover:text-white hover:border-cyan-400 font-display uppercase tracking-widest font-bold transition-all"
              >
                <SkipForward className="w-5 h-5" /> Skip Tutorial
              </button>
            </motion.div>
            <p className="text-center text-[10px] uppercase tracking-widest text-slate-500 font-mono -mt-2">Returning user? Skip straight to the real investigation.</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* "Why am I playing this game?" context modal */}
      <AnimatePresence>
        {showWhy && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowWhy(false)}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="cyber-clip-lg bg-[#0d0d1a] border-2 border-cyan-500/50 p-8 max-w-lg cyber-glow relative"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-400 to-transparent" />
              <button onClick={() => setShowWhy(false)} className="absolute top-3 right-3 text-cyan-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3 mb-4">
                <HelpCircle className="w-6 h-6 text-cyan-400" />
                <h3 className="text-xl font-display font-black text-cyan-300 uppercase tracking-widest">Why this game?</h3>
              </div>
              <p className="text-cyan-100/80 text-sm leading-relaxed font-mono mb-3">
                Phishing and digital fraud cost people billions every year. <span className="text-white">Spot the Phish</span> is a short, gamified trainer that sharpens your ability to spot deceptive messages — fake senders, malicious links, and pressure tactics — across email, SMS, WhatsApp, UPI and social media.
              </p>
              <p className="text-cyan-100/80 text-sm leading-relaxed font-mono">
                Your anonymous answers also support research on how people detect online scams, so future training can be more effective. Link your email on the start screen if you'd like to receive your personalized report.
              </p>
              <button onClick={() => setShowWhy(false)} className="mt-6 w-full py-3 cyber-clip bg-cyan-500 text-black font-display font-black tracking-widest uppercase hover:bg-cyan-400 transition-colors">
                Got it
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
