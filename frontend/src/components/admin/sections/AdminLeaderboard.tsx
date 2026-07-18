import React, { useEffect, useState } from 'react';
import { Trophy, Medal } from 'lucide-react';
import { adminApi } from '../../../api/adminApi';

export const AdminLeaderboard = () => {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { adminApi.getLeaderboard().then(setEntries).catch(console.error).finally(() => setLoading(false)); }, []);

  if (loading) return <div className="flex justify-center py-20"><div className="text-cyan-400 font-mono animate-pulse">Loading...</div></div>;

  const rankBadge = (rank: number) => {
    if (rank === 1) return <span className="text-2xl">🥇</span>;
    if (rank === 2) return <span className="text-2xl">🥈</span>;
    if (rank === 3) return <span className="text-2xl">🥉</span>;
    return <span className="font-mono font-black text-lg text-cyan-400/60">#{rank}</span>;
  };

  return (
    <div className="space-y-4">
      <div className="cyber-clip bg-[#0a0515] border border-cyan-500/20 p-4 md:p-6">
        <h3 className="text-sm font-display font-black text-yellow-400 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Trophy className="w-4 h-4" /> Current Leaderboard
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-mono">
            <thead>
              <tr className="border-b border-cyan-500/20">
                {['Rank', 'Codename', 'Player ID', 'Score', 'Games', 'Last Played'].map((h) => (
                  <th key={h} className="text-left py-3 px-3 text-[10px] uppercase tracking-widest text-slate-500 font-bold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.playerId} className="border-b border-slate-800/50 hover:bg-white/5">
                  <td className="py-3 px-3">{rankBadge(e.rank)}</td>
                  <td className="py-3 px-3 text-white font-bold">{e.codename}</td>
                  <td className="py-3 px-3 text-slate-400 text-xs max-w-[120px] truncate">{e.playerId}</td>
                  <td className="py-3 px-3 text-yellow-400 font-black text-lg">{e.latestScore}</td>
                  <td className="py-3 px-3 text-cyan-400">{e.gamesPlayed}</td>
                  <td className="py-3 px-3 text-slate-500">{e.lastPlayedAt ? new Date(e.lastPlayedAt).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr><td colSpan={6} className="py-12 text-center text-slate-500">No leaderboard entries</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
