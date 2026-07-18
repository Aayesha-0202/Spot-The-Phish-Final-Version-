import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Trophy, Target, Clock, Gamepad2, Brain, TrendingUp, Loader2, Crown, Shield, Mail } from 'lucide-react';
import { gameApi } from '../../api/gameApi';
import { useGameStore } from '../../store/gameStore';

interface ProfileData {
  player: { playerId: string; name: string | null; email: string | null; createdAt: string | null };
  stats: {
    totalGames: number;
    bestScore: number;
    avgScore: number;
    bestTime: number | null;
    stimuliCorrect: number;
    stimuliTotal: number;
  };
  recentSessions: {
    sessionId: string;
    score: number;
    designation: string;
    completionTimeMs: number;
    completedLevels: number;
    completedAt: string;
  }[];
}

function fmtTime(ms?: number | null): string {
  if (typeof ms !== 'number' || ms <= 0) return '—';
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}m ${sec.toString().padStart(2, '0')}s`;
}

function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return '—'; }
}

export const ProfileScreen = () => {
  const navigate = useNavigate();
  const playerId = useGameStore((s) => s.playerId);
  const playerName = useGameStore((s) => s.playerName);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!playerId) { setLoading(false); return; }
    setLoading(true);
    gameApi.getPlayerProfile(playerId)
      .then((res: any) => setProfile(res.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [playerId]);

  const accuracy = profile?.stats.stimuliTotal
    ? Math.round((profile.stats.stimuliCorrect / profile.stats.stimuliTotal) * 100)
    : 0;

  return (
    <div className="min-h-screen w-full bg-cyber-grid bg-[#0d0d1a] text-white relative overflow-y-auto">
      <div className="absolute top-0 w-full h-2 bg-gradient-to-r from-yellow-400 via-cyan-400 to-pink-500 opacity-80" />

      <div className="max-w-4xl mx-auto px-4 md:px-8 py-10 relative z-10">
        {/* Header */}
        <div className="flex flex-col items-center mb-10">
          <button
            onClick={() => navigate(-1)}
            className="self-start flex items-center gap-1.5 text-xs uppercase tracking-widest font-bold text-cyan-300 hover:text-cyan-200 cyber-clip border border-cyan-500/40 px-3 py-2 mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>

          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-3">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500 to-pink-500 flex items-center justify-center">
              <Brain className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-display font-black tracking-[0.15em] uppercase text-cyan-400">
              {profile?.player.name || playerName || 'Agent'}
            </h1>
            {profile?.player.email && (
              <div className="flex items-center gap-1.5 text-slate-400 font-mono text-xs">
                <Mail className="w-3.5 h-3.5" /> {profile.player.email}
              </div>
            )}
            {profile?.player.createdAt && (
              <p className="text-slate-500 font-mono text-xs">Member since {fmtDate(profile.player.createdAt)}</p>
            )}
          </motion.div>
        </div>

        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-24 text-red-400 font-mono text-sm">{error}</div>
        ) : !profile ? (
          <div className="text-center py-24 text-slate-500 font-mono text-sm">No profile data found.</div>
        ) : profile.stats.totalGames === 0 ? (
          /* New player — no games yet */
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center py-16">
            <Shield className="w-16 h-16 text-cyan-400/40 mx-auto mb-6" />
            <h2 className="text-2xl font-display font-black text-white mb-3">Welcome, Agent!</h2>
            <p className="text-slate-400 font-mono text-sm mb-2 max-w-md mx-auto">
              You haven't completed any assessments yet. Play the game to build your cybersecurity awareness score and climb the leaderboard.
            </p>
            <p className="text-slate-600 font-mono text-xs mb-8">
              Your codename and stats will appear here after your first game.
            </p>
            <button
              onClick={() => navigate('/')}
              className="px-8 py-3 text-xs uppercase tracking-widest font-bold text-cyan-300 border-2 border-cyan-400 cyber-clip hover:bg-cyan-400 hover:text-black transition-colors"
            >
              Play Now
            </button>
          </motion.div>
        ) : (
          <>
            {/* Stats Grid */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10"
            >
              <div className="cyber-clip p-5 border border-cyan-500/30 bg-[#0a0515] text-center">
                <Crown className="w-5 h-5 text-yellow-400 mx-auto mb-2" />
                <div className="text-[11px] uppercase tracking-widest text-slate-500 font-bold mb-1">Best Score</div>
                <div className="font-mono font-black text-3xl text-white">{profile.stats.bestScore}</div>
                <div className="text-[11px] text-slate-600 font-mono">PTS</div>
              </div>
              <div className="cyber-clip p-5 border border-cyan-500/30 bg-[#0a0515] text-center">
                <Target className="w-5 h-5 text-cyan-400 mx-auto mb-2" />
                <div className="text-[11px] uppercase tracking-widest text-slate-500 font-bold mb-1">Avg Score</div>
                <div className="font-mono font-black text-3xl text-white">{profile.stats.avgScore}</div>
                <div className="text-[11px] text-slate-600 font-mono">PTS</div>
              </div>
              <div className="cyber-clip p-5 border border-cyan-500/30 bg-[#0a0515] text-center">
                <Gamepad2 className="w-5 h-5 text-pink-400 mx-auto mb-2" />
                <div className="text-[11px] uppercase tracking-widest text-slate-500 font-bold mb-1">Games Played</div>
                <div className="font-mono font-black text-3xl text-white">{profile.stats.totalGames}</div>
              </div>
              <div className="cyber-clip p-5 border border-cyan-500/30 bg-[#0a0515] text-center">
                <Clock className="w-5 h-5 text-yellow-400 mx-auto mb-2" />
                <div className="text-[11px] uppercase tracking-widest text-slate-500 font-bold mb-1">Best Time</div>
                <div className="font-mono font-black text-3xl text-white">{fmtTime(profile.stats.bestTime)}</div>
              </div>
              <div className="cyber-clip p-5 border border-cyan-500/30 bg-[#0a0515] text-center">
                <TrendingUp className="w-5 h-5 text-green-400 mx-auto mb-2" />
                <div className="text-[11px] uppercase tracking-widest text-slate-500 font-bold mb-1">Accuracy</div>
                <div className="font-mono font-black text-3xl text-white">{accuracy}%</div>
              </div>
              <div className="cyber-clip p-5 border border-cyan-500/30 bg-[#0a0515] text-center">
                <Brain className="w-5 h-5 text-cyan-400 mx-auto mb-2" />
                <div className="text-[11px] uppercase tracking-widest text-slate-500 font-bold mb-1">Stimuli Reviewed</div>
                <div className="font-mono font-black text-3xl text-white">{profile.stats.stimuliCorrect}/{profile.stats.stimuliTotal}</div>
              </div>
            </motion.div>

            {/* Game History */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <h2 className="text-xl font-display font-black tracking-widest uppercase text-yellow-400 mb-4 border-b border-yellow-400/30 pb-2">
                Recent Games
              </h2>
              {profile.recentSessions.length === 0 ? (
                <div className="text-center py-12 text-slate-500 font-mono text-sm">No games played yet.</div>
              ) : (
                <div className="space-y-2">
                  {profile.recentSessions.map((s, i) => (
                    <motion.div
                      key={s.sessionId}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="cyber-clip border border-cyan-500/20 bg-[#0a0515] p-4 grid grid-cols-[1fr_auto] md:grid-cols-[1fr_120px_120px_100px] gap-3 items-center"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-white text-sm truncate">{s.designation || 'Unknown'}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{fmtDate(s.completedAt)}</div>
                      </div>
                      <div className="text-right md:text-center">
                        <div className="font-mono font-black text-lg text-cyan-400">{s.score}</div>
                        <div className="text-[10px] text-slate-600 uppercase">PTS</div>
                      </div>
                      <div className="text-right md:text-center hidden md:block">
                        <div className="font-mono text-sm text-yellow-400/90">{fmtTime(s.completionTimeMs)}</div>
                        <div className="text-[10px] text-slate-600 uppercase">TIME</div>
                      </div>
                      <div className="text-right md:text-center hidden md:block">
                        <div className="font-mono text-sm text-pink-400">Lvl {s.completedLevels}</div>
                        <div className="text-[10px] text-slate-600 uppercase">LEVEL</div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
};
