import React, { useEffect, useState } from 'react';
import { Gamepad2, Clock, Target, TrendingUp, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { adminApi } from '../../../api/adminApi';

const COLORS = ['#22d3ee', '#ec4899', '#facc15', '#4ade80', '#a78bfa', '#f87171', '#fb923c', '#38bdf8'];

export const AdminGameAnalytics = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { adminApi.getGameAnalytics().then(setData).catch(console.error).finally(() => setLoading(false)); }, []);

  if (loading) return <div className="flex justify-center py-20"><div className="text-cyan-400 font-mono animate-pulse">Loading...</div></div>;
  if (!data) return <div className="text-red-400 font-mono py-20 text-center">Failed to load analytics</div>;

  const { summary: s, roundAccuracy, scoreDistribution, wrongAnswersHeatmap } = data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Games', value: s.totalGames, icon: Gamepad2, color: 'text-cyan-400' },
          { label: 'Games Today', value: s.gamesToday, icon: TrendingUp, color: 'text-green-400' },
          { label: 'Games This Week', value: s.gamesWeek, icon: TrendingUp, color: 'text-yellow-400' },
          { label: 'Games This Month', value: s.gamesMonth, icon: TrendingUp, color: 'text-pink-400' },
          { label: 'Avg Score', value: s.averageScore, icon: Target, color: 'text-cyan-400' },
          { label: 'Avg Accuracy', value: `${s.averageAccuracy}%`, icon: Target, color: 'text-green-400' },
          { label: 'Avg Time', value: s.averageCompletionTime ? `${Math.round(s.averageCompletionTime / 1000)}s` : '—', icon: Clock, color: 'text-pink-400' },
        ].map((item) => (
          <div key={item.label} className="cyber-clip bg-[#0a0515] border border-cyan-500/20 p-4">
            <div className="flex items-center gap-2 mb-2">
              <item.icon className={`w-4 h-4 ${item.color}`} />
              <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">{item.label}</span>
            </div>
            <div className="text-2xl font-mono font-black text-white">{item.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="cyber-clip bg-[#0a0515] border border-cyan-500/20 p-4 md:p-6">
          <h3 className="text-sm font-display font-black text-cyan-300 uppercase tracking-widest mb-4">Accuracy by Tier</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={roundAccuracy}>
                <CartesianGrid stroke="rgba(34,211,238,0.1)" />
                <XAxis dataKey="tier" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip contentStyle={{ background: '#0d0d1a', border: '1px solid rgba(34,211,238,0.4)', color: '#fff', fontSize: 12 }} />
                <Bar dataKey="accuracy" fill="#22d3ee" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="cyber-clip bg-[#0a0515] border border-cyan-500/20 p-4 md:p-6">
          <h3 className="text-sm font-display font-black text-cyan-300 uppercase tracking-widest mb-4">Score Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scoreDistribution}>
                <CartesianGrid stroke="rgba(34,211,238,0.1)" />
                <XAxis dataKey="_id" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip contentStyle={{ background: '#0d0d1a', border: '1px solid rgba(34,211,238,0.4)', color: '#fff', fontSize: 12 }} />
                <Bar dataKey="count" fill="#ec4899" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {wrongAnswersHeatmap.length > 0 && (
        <div className="cyber-clip bg-[#0a0515] border border-cyan-500/20 p-4 md:p-6">
          <h3 className="text-sm font-display font-black text-pink-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Wrong Answers Heatmap (Top 50)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-mono">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-2 px-2 text-[10px] uppercase text-slate-500 font-bold">Category</th>
                  <th className="text-left py-2 px-2 text-[10px] uppercase text-slate-500 font-bold">Tier</th>
                  <th className="text-right py-2 px-2 text-[10px] uppercase text-slate-500 font-bold">Wrong Count</th>
                </tr>
              </thead>
              <tbody>
                {wrongAnswersHeatmap.map((h: any, i: number) => (
                  <tr key={i} className="border-b border-slate-800/30">
                    <td className="py-2 px-2 text-white text-xs">{h._id.category}</td>
                    <td className="py-2 px-2 text-cyan-400">{h._id.tier}</td>
                    <td className="py-2 px-2 text-right text-red-400 font-bold">{h.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
