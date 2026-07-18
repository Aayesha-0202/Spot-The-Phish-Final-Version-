import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { adminApi } from '../../../api/adminApi';

export const AdminStimulusAnalytics = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { adminApi.getStimulusAnalytics().then(setData).catch(console.error).finally(() => setLoading(false)); }, []);

  if (loading) return <div className="flex justify-center py-20"><div className="text-cyan-400 font-mono animate-pulse">Loading...</div></div>;
  if (!data) return <div className="text-red-400 font-mono py-20 text-center">Failed to load analytics</div>;

  const { hardest, easiest, mostPlayed, leastPlayed, misclassified } = data;

  const Section = ({ title, items, color }: { title: string; items: any[]; color: string }) => (
    <div className="cyber-clip bg-[#0a0515] border border-cyan-500/20 p-4 md:p-6">
      <h3 className={`text-sm font-display font-black uppercase tracking-widest mb-4 ${color}`}>{title}</h3>
      {items.length === 0 ? (
        <div className="text-slate-500 text-sm font-mono">No data available</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-mono">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left py-2 px-2 text-[10px] uppercase text-slate-500 font-bold">ID</th>
                <th className="text-left py-2 px-2 text-[10px] uppercase text-slate-500 font-bold">Category</th>
                <th className="text-left py-2 px-2 text-[10px] uppercase text-slate-500 font-bold">Tier</th>
                <th className="text-right py-2 px-2 text-[10px] uppercase text-slate-500 font-bold">Played</th>
                <th className="text-right py-2 px-2 text-[10px] uppercase text-slate-500 font-bold">Correct %</th>
                <th className="text-right py-2 px-2 text-[10px] uppercase text-slate-500 font-bold">Avg Time</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s: any) => (
                <tr key={s.stimulusId} className="border-b border-slate-800/30 hover:bg-white/5">
                  <td className="py-2 px-2 text-slate-400 text-xs max-w-[80px] truncate">{s.stimulusId}</td>
                  <td className="py-2 px-2 text-white text-xs">{s.category}</td>
                  <td className="py-2 px-2 text-cyan-400">{s.tier}</td>
                  <td className="py-2 px-2 text-right text-slate-400">{s.timesPlayed}</td>
                  <td className="py-2 px-2 text-right">
                    <span className={s.correctPct >= 70 ? 'text-green-400' : s.correctPct >= 40 ? 'text-yellow-400' : 'text-red-400'}>{s.correctPct}%</span>
                  </td>
                  <td className="py-2 px-2 text-right text-slate-400">{s.avgResponseTimeMs ? `${Math.round(s.avgResponseTimeMs / 1000)}s` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Section title="Top 20 Hardest Stimuli" items={hardest} color="text-red-400" />
        <Section title="Top 20 Easiest Stimuli" items={easiest} color="text-green-400" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Section title="Most Misclassified Stimuli" items={misclassified} color="text-yellow-400" />
        <Section title="Most Played Stimuli" items={mostPlayed} color="text-cyan-400" />
      </div>
      <Section title="Least Played Stimuli" items={leastPlayed} color="text-pink-400" />
    </div>
  );
};
