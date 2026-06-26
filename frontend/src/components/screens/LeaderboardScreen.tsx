import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, ArrowLeft, Crown, Flame, Target, Loader2 } from 'lucide-react';
import { leaderboardApi, type LeaderboardRow, type LeaderboardPeriod } from '../../api/leaderboardApi';
import { useAuthStore } from '../../store/authStore';

const PERIODS: { key: LeaderboardPeriod | 'recent'; label: string }[] = [
  { key: 'all', label: 'All Time' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'recent', label: 'Recent' },
];

function medal(rank?: number | null): string {
  if (rank === 1) return 'text-yellow-400';
  if (rank === 2) return 'text-slate-300';
  if (rank === 3) return 'text-amber-600';
  return 'text-cyan-400';
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '—';
  }
}

export const LeaderboardScreen = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const [view, setView] = useState<LeaderboardPeriod | 'recent'>('all');
  const [entries, setEntries] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [rankInfo, setRankInfo] = useState<{ rank: number | null; totalPlayers: number } | null>(null);
  const [best, setBest] = useState<LeaderboardRow | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async (period: LeaderboardPeriod | 'recent') => {
    setLoading(true);
    setError('');
    try {
      const res = period === 'recent' ? await leaderboardApi.recent(20) : await leaderboardApi.top(20, period, 0);
      setEntries(res.entries);
    } catch (e) {
      setError((e as Error).message);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = async () => {
    if (view === 'recent') return;
    setLoadingMore(true);
    try {
      const res = await leaderboardApi.top(20, view, entries.length);
      setEntries((prev) => [...prev, ...res.entries]);
    } catch {
      /* ignore */
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    load(view);
  }, [view, load]);

  // Personal stats (only meaningful for authed users).
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
      <div className="absolute top-0 w-full h-2 bg-gradient-to-r from-yellow-400 via-cyan-400 to-pink-500 opacity-80" />

      <div className="max-w-4xl mx-auto px-4 md:px-8 py-10 relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-xs uppercase tracking-widest font-bold text-cyan-300 hover:text-cyan-200 cyber-clip border border-cyan-500/40 px-3 py-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="flex items-center gap-2">
            <Trophy className="w-6 h-6 text-yellow-400" />
            <h1 className="text-2xl md:text-3xl font-display font-black tracking-widest uppercase text-yellow-400 cyber-glow-text-yellow">Leaderboard</h1>
          </div>
        </div>

        {/* Your stats */}
        {isAuthenticated && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <StatCard icon={<Crown className="w-4 h-4" />} label="Your Rank" value={rankInfo?.rank ? `#${rankInfo.rank}` : '—'} sub={rankInfo ? `of ${rankInfo.totalPlayers}` : ''} />
            <StatCard icon={<Target className="w-4 h-4" />} label="Best Score" value={best ? String(best.compositeScore) : '—'} sub="PTS" />
            <StatCard icon={<Flame className="w-4 h-4" />} label="Best Streak" value={best ? String(best.highestStreak) : '—'} sub="combo" />
            <StatCard icon={<Trophy className="w-4 h-4" />} label="Designation" value={best?.designation || '—'} sub="" small />
          </div>
        )}
        {!isAuthenticated && (
          <div className="mb-8 p-4 border border-yellow-500/40 bg-yellow-500/5 text-yellow-200/80 text-xs font-mono cyber-clip">
            Sign in or create an account to submit your scores and appear on the leaderboard. Guests can browse but aren't ranked.
          </div>
        )}

        {/* Period selector */}
        <div className="flex flex-wrap gap-2 mb-6">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setView(p.key)}
              className={`px-4 py-2 text-[10px] uppercase tracking-widest font-bold cyber-clip border transition-colors ${
                view === p.key ? 'bg-cyan-400 text-black border-cyan-400' : 'bg-[#0d0d1a] text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/10'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-20 text-red-400 font-mono text-sm">{error}</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-20 text-slate-500 font-mono text-sm uppercase tracking-widest">No scores yet — be the first.</div>
        ) : (
          <div className="space-y-2">
            {entries.map((row, i) => {
              const isMe = !!user && (row.isCurrentUser || row.user === user._id);
              return (
                <motion.div
                  key={row._id + i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.4) }}
                  className={`cyber-clip p-3 md:p-4 border flex items-center gap-3 md:gap-4 ${
                    isMe ? 'border-yellow-400 bg-yellow-400/10 cyber-glow-yellow' : 'border-cyan-500/30 bg-[#0a0515]'
                  }`}
                >
                  <div className={`w-10 md:w-12 text-center font-display font-black text-lg md:text-xl ${medal(row.rank ?? i + 1)}`}>
                    {row.rank ?? i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm md:text-base text-white truncate">{row.playerName}</span>
                      {isMe && <span className="text-[9px] uppercase tracking-widest text-yellow-400 font-bold">YOU</span>}
                    </div>
                    <div className="text-[10px] md:text-xs text-pink-400 font-mono truncate">{row.designation || '—'}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-black text-lg md:text-xl text-cyan-400">{row.compositeScore}</div>
                    <div className="text-[9px] uppercase tracking-widest text-slate-500">pts</div>
                  </div>
                  <div className="hidden md:flex flex-col items-center text-[10px] text-slate-400 font-mono w-16">
                    <Flame className="w-3.5 h-3.5 text-orange-400 mb-0.5" />
                    {row.highestStreak}
                  </div>
                  <div className="hidden md:block text-[10px] text-slate-500 font-mono w-12 text-right">{fmtDate(row.completedAt)}</div>
                </motion.div>
              );
            })}

            {view !== 'recent' && entries.length >= 20 && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="w-full py-3 mt-2 text-xs uppercase tracking-widest font-bold text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/10 cyber-clip flex justify-center items-center gap-2 disabled:opacity-60"
              >
                {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />} Load more
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

function StatCard({ icon, label, value, sub, small }: { icon: React.ReactNode; label: string; value: string; sub: string; small?: boolean }) {
  return (
    <div className="cyber-clip p-3 border border-cyan-500/30 bg-[#0a0515]">
      <div className="flex items-center gap-1.5 text-cyan-400 mb-1">
        {icon}
        <span className="text-[9px] uppercase tracking-widest font-bold">{label}</span>
      </div>
      <div className={`font-mono font-black text-white ${small ? 'text-sm' : 'text-xl'}`}>{value}</div>
      {sub && <div className="text-[9px] text-slate-500 uppercase">{sub}</div>}
    </div>
  );
}
