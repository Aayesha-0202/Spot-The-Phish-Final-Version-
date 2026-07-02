import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, ArrowLeft, Crown, Target, Loader2, Zap } from 'lucide-react';
import { leaderboardApi, type LeaderboardRow } from '../../api/leaderboardApi';
import { useAuthStore } from '../../store/authStore';

function fmtTime(ms?: number): string {
  if (typeof ms !== 'number') return '—';
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}m ${sec.toString().padStart(2, '0')}s`;
}

function rankStyle(rank: number) {
  if (rank === 1) return 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/5 border-yellow-400/60';
  if (rank === 2) return 'bg-gradient-to-r from-slate-300/10 to-slate-400/5 border-slate-400/40';
  if (rank === 3) return 'bg-gradient-to-r from-amber-600/10 to-amber-700/5 border-amber-500/40';
  return 'bg-[#0a0515] border-cyan-500/20';
}

function rankBadge(rank: number) {
  if (rank === 1) return <span className="text-3xl" title="1st Place">🥇</span>;
  if (rank === 2) return <span className="text-3xl" title="2nd Place">🥈</span>;
  if (rank === 3) return <span className="text-3xl" title="3rd Place">🥉</span>;
  return <span className="font-mono font-black text-2xl text-cyan-400/60">#{rank}</span>;
}

export const LeaderboardScreen = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const [entries, setEntries] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [rankInfo, setRankInfo] = useState<{ rank: number | null; totalPlayers: number } | null>(null);
  const [best, setBest] = useState<LeaderboardRow | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await leaderboardApi.top(50, 'all', 0);
      setEntries(res.entries);
    } catch (e) {
      setError((e as Error).message);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!isAuthenticated) {
      setRankInfo(null);
      setBest(null);
      return;
    }
    Promise.all([leaderboardApi.myRank(), leaderboardApi.myBest()])
      .then(([r, b]) => {
        setRankInfo(r);
        setBest(b.entry);
      })
      .catch(() => undefined);
  }, [isAuthenticated, entries]);

  return (
    <div className="min-h-screen w-full bg-cyber-grid bg-[#0d0d1a] text-white relative overflow-y-auto">
      {/* Top gradient bar */}
      <div className="absolute top-0 w-full h-2 bg-gradient-to-r from-yellow-400 via-cyan-400 to-pink-500 opacity-80" />

      <div className="max-w-5xl mx-auto px-4 md:px-8 py-10 relative z-10">

        {/* ===== HEADER ===== */}
        <div className="flex flex-col items-center mb-12">
          <button
            onClick={() => navigate('/')}
            className="self-start flex items-center gap-1.5 text-xs uppercase tracking-widest font-bold text-cyan-300 hover:text-cyan-200 cyber-clip border border-cyan-500/40 px-3 py-2 mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>

          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center gap-4"
          >
            <div className="relative">
              <Trophy className="w-16 h-16 text-yellow-400" strokeWidth={1.5} />
              <div className="absolute inset-0 blur-xl bg-yellow-400/20 rounded-full" />
            </div>
            <h1 className="text-5xl md:text-7xl font-display font-black tracking-[0.15em] uppercase text-yellow-400 cyber-glow-text-yellow">
              Leaderboard
            </h1>
            <p className="text-cyan-300/60 font-mono text-sm tracking-widest uppercase">
              Top Operatives — Neural Threat Detection
            </p>
          </motion.div>
        </div>

        {/* ===== YOUR STATS (authed only) ===== */}
        {isAuthenticated && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10"
          >
            <div className="cyber-clip p-5 border border-cyan-500/30 bg-[#0a0515] text-center">
              <Crown className="w-5 h-5 text-cyan-400 mx-auto mb-2" />
              <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Your Rank</div>
              <div className="font-mono font-black text-2xl text-white">{rankInfo?.rank ? `#${rankInfo.rank}` : '—'}</div>
              {rankInfo && <div className="text-[10px] text-slate-600 font-mono">of {rankInfo.totalPlayers}</div>}
            </div>
            <div className="cyber-clip p-5 border border-cyan-500/30 bg-[#0a0515] text-center">
              <Target className="w-5 h-5 text-yellow-400 mx-auto mb-2" />
              <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Best Score</div>
              <div className="font-mono font-black text-2xl text-white">{best ? best.compositeScore : '—'}</div>
              <div className="text-[10px] text-slate-600 font-mono">PTS</div>
            </div>
            <div className="cyber-clip p-5 border border-cyan-500/30 bg-[#0a0515] text-center">
              <Zap className="w-5 h-5 text-pink-400 mx-auto mb-2" />
              <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Best Time</div>
              <div className="font-mono font-black text-2xl text-white">{best ? fmtTime(best.completionTimeMs) : '—'}</div>
            </div>
            <div className="cyber-clip p-5 border border-cyan-500/30 bg-[#0a0515] text-center">
              <Trophy className="w-5 h-5 text-pink-400 mx-auto mb-2" />
              <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Designation</div>
              <div className="font-display font-black text-sm text-pink-400 tracking-wider uppercase">{best?.designation || '—'}</div>
            </div>
          </motion.div>
        )}

        {!isAuthenticated && (
          <div className="mb-8 p-4 border border-yellow-500/40 bg-yellow-500/5 text-yellow-200/80 text-xs font-mono cyber-clip text-center">
            Sign in or create an account to submit your scores and appear on the leaderboard.
          </div>
        )}

        {/* ===== LEADERBOARD LIST ===== */}
        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-24 text-red-400 font-mono text-sm">{error}</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-24">
            <Trophy className="w-16 h-16 text-slate-700 mx-auto mb-4" />
            <div className="text-slate-500 font-mono text-sm uppercase tracking-widest">No scores yet — be the first.</div>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.slice(0, 10).map((row, i) => {
              const isMe = !!user && (row.isCurrentUser || row.user === user._id);
              const rank = row.rank ?? i + 1;
              return (
                <motion.div
                  key={row._id + i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.05, 0.5) }}
                  className={`cyber-clip border p-4 md:p-5 ${
                    isMe ? 'border-yellow-400 bg-yellow-400/10 cyber-glow-yellow' : rankStyle(rank)
                  }`}
                >
                  <div className="grid grid-cols-[50px_1fr] md:grid-cols-[80px_1fr_180px_120px_120px] gap-4 items-center">
                    {/* Rank */}
                    <div className="flex items-center justify-center">
                      {rankBadge(rank)}
                    </div>

                    {/* Codename */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base md:text-lg text-white truncate">{row.playerName}</span>
                        {isMe && (
                          <span className="text-[9px] uppercase tracking-widest text-yellow-400 font-bold px-2 py-0.5 bg-yellow-400/10 border border-yellow-400/40 shrink-0">
                            YOU
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Designation */}
                    <div className="hidden md:block">
                      <span className="font-mono text-xs text-pink-400 font-bold tracking-wider uppercase">
                        {row.designation || '—'}
                      </span>
                    </div>

                    {/* Points */}
                    <div className="text-right">
                      <span className="font-mono font-black text-2xl md:text-3xl text-cyan-400">{row.compositeScore}</span>
                      <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold ml-1">pts</span>
                    </div>

                    {/* Time */}
                    <div className="text-right">
                      <span className="font-mono text-sm md:text-base text-yellow-400/90 font-bold">{fmtTime(row.completionTimeMs)}</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
