import React, { useEffect, useState, useCallback } from 'react';
import { Search, ChevronLeft, ChevronRight, Eye, X } from 'lucide-react';
import { adminApi } from '../../../api/adminApi';

function PlayerProfileModal({ playerId, onClose }: { playerId: string; onClose: () => void }) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    adminApi.getPlayerProfile(playerId).then(setProfile).catch(console.error).finally(() => setLoading(false));
  }, [playerId]);

  if (loading) return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="text-cyan-400 font-mono animate-pulse" onClick={(e) => e.stopPropagation()}>Loading profile...</div>
    </div>
  );

  if (!profile) return null;
  const { player: p, stats: st, tierProgress, recentSessions } = profile;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="cyber-clip-lg bg-[#0a0515] border-2 border-cyan-500/40 max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-display font-black text-cyan-300 uppercase tracking-widest">Player Profile</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { k: 'Codename', v: p.codename },
              { k: 'Player ID', v: p.playerId },
              { k: 'Email', v: p.email || '—' },
              { k: 'Joined', v: new Date(p.createdAt).toLocaleDateString() },
            ].map((item) => (
              <div key={item.k} className="bg-black/40 p-3 border border-slate-800">
                <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">{item.k}</div>
                <div className="text-sm font-mono text-white mt-1 truncate">{item.v}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {[
              { k: 'Games', v: st.gamesPlayed },
              { k: 'Latest', v: st.latestScore ?? '—' },
              { k: 'Highest', v: st.highestScore ?? '—' },
              { k: 'Accuracy', v: st.averageAccuracy ? `${st.averageAccuracy}%` : '—' },
              { k: 'Avg Time', v: st.averageCompletionTime ? `${Math.round(st.averageCompletionTime / 1000)}s` : '—' },
              { k: 'Rank', v: st.rank ? `#${st.rank}` : '—' },
            ].map((item) => (
              <div key={item.k} className="bg-black/40 p-3 border border-slate-800 text-center">
                <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">{item.k}</div>
                <div className="text-lg font-mono font-black text-cyan-400">{item.v}</div>
              </div>
            ))}
          </div>

          <div className="bg-black/40 p-4 border border-slate-800">
            <div className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-3">Stimuli Progress ({st.stimuliSeen} seen / {st.remainingUnseen} remaining)</div>
            <div className="space-y-2">
              {tierProgress.map((t: any) => (
                <div key={t.tier} className="flex items-center gap-3">
                  <span className="text-xs font-mono text-slate-400 w-16">Tier {t.tier}</span>
                  <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${t.seen + t.remaining > 0 ? (t.seen / (t.seen + t.remaining)) * 100 : 0}%` }} />
                  </div>
                  <span className="text-xs font-mono text-slate-500 w-20 text-right">{t.seen}/{t.seen + t.remaining}</span>
                </div>
              ))}
            </div>
          </div>

          {recentSessions.length > 0 && (
            <div className="bg-black/40 p-4 border border-slate-800">
              <div className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-3">Recent Sessions</div>
              <div className="space-y-2">
                {recentSessions.slice(0, 5).map((s: any) => (
                  <div key={s.sessionId} className="flex justify-between items-center text-sm font-mono py-1 border-b border-slate-800/50">
                    <span className="text-white">{s.score} pts</span>
                    <span className="text-pink-400">{s.designation}</span>
                    <span className="text-slate-500">{s.completionTimeMs ? `${Math.round(s.completionTimeMs / 1000)}s` : '—'}</span>
                    <span className="text-slate-600">{new Date(s.completedAt).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const AdminPlayers = () => {
  const [players, setPlayers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: '20' };
      if (search) params.search = search;
      const res = await adminApi.getPlayers(params);
      setPlayers(res.players);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400/60" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name, ID, or email..."
            className="w-full bg-black/50 border border-cyan-500/30 text-white placeholder-slate-600 pl-10 pr-4 p-2.5 text-sm font-mono focus:border-cyan-400 outline-none cyber-clip"
          />
        </div>
        <div className="text-sm text-slate-500 font-mono flex items-center">{total} players</div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm font-mono">
          <thead>
            <tr className="border-b border-cyan-500/20">
              {['Player ID', 'Codename', 'Email', 'Games', 'Score', 'Rank', 'Last Played', 'Status', ''].map((h) => (
                <th key={h} className="text-left py-3 px-3 text-[10px] uppercase tracking-widest text-slate-500 font-bold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="py-12 text-center text-cyan-400 animate-pulse">Loading...</td></tr>
            ) : players.length === 0 ? (
              <tr><td colSpan={9} className="py-12 text-center text-slate-500">No players found</td></tr>
            ) : players.map((p) => (
              <tr key={p.playerId} className="border-b border-slate-800/50 hover:bg-white/5">
                <td className="py-3 px-3 text-slate-400 max-w-[120px] truncate">{p.playerId}</td>
                <td className="py-3 px-3 text-white font-bold">{p.codename}</td>
                <td className="py-3 px-3 text-slate-400">{p.email || '—'}</td>
                <td className="py-3 px-3 text-cyan-400">{p.gamesPlayed}</td>
                <td className="py-3 px-3 text-yellow-400 font-bold">{p.latestScore ?? '—'}</td>
                <td className="py-3 px-3 text-pink-400">{p.rank ? `#${p.rank}` : '—'}</td>
                <td className="py-3 px-3 text-slate-500">{p.lastPlayedAt ? new Date(p.lastPlayedAt).toLocaleDateString() : '—'}</td>
                <td className="py-3 px-3">
                  <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${p.status === 'Active' ? 'text-green-400 bg-green-500/10 border border-green-500/30' : 'text-slate-500 bg-slate-800/50 border border-slate-700'}`}>
                    {p.status}
                  </span>
                </td>
                <td className="py-3 px-3">
                  <button onClick={() => setSelectedPlayer(p.playerId)} className="text-cyan-400 hover:text-cyan-300"><Eye className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-2 text-cyan-400 hover:text-white disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-sm font-mono text-slate-400">Page {page} of {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 text-cyan-400 hover:text-white disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
        </div>
      )}

      {selectedPlayer && <PlayerProfileModal playerId={selectedPlayer} onClose={() => setSelectedPlayer(null)} />}
    </div>
  );
};
