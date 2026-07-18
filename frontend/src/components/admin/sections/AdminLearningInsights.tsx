import React, { useEffect, useState } from 'react';
import { Lightbulb, AlertTriangle, TrendingDown, Eye, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { adminApi } from '../../../api/adminApi';

export const AdminLearningInsights = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { adminApi.getLearningInsights().then(setData).catch(console.error).finally(() => setLoading(false)); }, []);

  if (loading) return <div className="flex justify-center py-20"><div className="text-cyan-400 font-mono animate-pulse">Loading...</div></div>;
  if (!data) return <div className="text-red-400 font-mono py-20 text-center">Failed to load learning insights</div>;

  const { summary, categoryAccuracy, misclassifiedStimuli, worstPerTier, playerPatterns } = data;

  const Section = ({ title, icon: Icon, color, children }: { title: string; icon: any; color: string; children: React.ReactNode }) => (
    <div className="cyber-clip bg-[#0a0515] border border-cyan-500/20 p-4 md:p-6">
      <h3 className={`text-sm font-display font-black uppercase tracking-widest mb-4 flex items-center gap-2 ${color}`}>
        <Icon className="w-4 h-4" /> {title}
      </h3>
      {children}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Misclassified', value: summary.totalMisclassified, color: 'text-red-400' },
          { label: 'Avg Confidence', value: `${summary.averageConfidence}%`, color: 'text-yellow-400' },
          { label: 'Players with Gaps', value: summary.playersWithGaps, color: 'text-pink-400' },
          { label: 'Avg Gap Accuracy', value: summary.averageGapAccuracy ? `${summary.averageGapAccuracy}%` : '—', color: 'text-cyan-400' },
        ].map((item) => (
          <div key={item.label} className="cyber-clip bg-[#0a0515] border border-cyan-500/20 p-4">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">{item.label}</div>
            <div className={`text-2xl font-mono font-black ${item.color}`}>{item.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Section title="Accuracy by Category" icon={BarChart3} color="text-cyan-400">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryAccuracy}>
                <CartesianGrid stroke="rgba(34,211,238,0.1)" />
                <XAxis dataKey="_id" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip contentStyle={{ background: '#0d0d1a', border: '1px solid rgba(34,211,238,0.4)', color: '#fff', fontSize: 12 }} />
                <Bar dataKey="accuracy" fill="#22d3ee" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>

        <Section title="Weakest Tier Accuracy" icon={TrendingDown} color="text-yellow-400">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={worstPerTier}>
                <CartesianGrid stroke="rgba(34,211,238,0.1)" />
                <XAxis dataKey="tier" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip contentStyle={{ background: '#0d0d1a', border: '1px solid rgba(34,211,238,0.4)', color: '#fff', fontSize: 12 }} />
                <Bar dataKey="accuracy" fill="#ec4899" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
      </div>

      {misclassifiedStimuli.length > 0 && (
        <Section title="Most Misclassified Stimuli" icon={AlertTriangle} color="text-red-400">
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-mono">
              <thead>
                <tr className="border-b border-slate-800">
                  {['Stimulus', 'Category', 'Tier', 'Wrong Count', 'Avg Confidence'].map((h) => (
                    <th key={h} className="text-left py-2 px-2 text-[10px] uppercase text-slate-500 font-bold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {misclassifiedStimuli.map((s: any) => (
                  <tr key={s.stimulusId} className="border-b border-slate-800/30 hover:bg-white/5">
                    <td className="py-2 px-2 text-slate-400 text-xs max-w-[100px] truncate">{s.stimulusId}</td>
                    <td className="py-2 px-2 text-white text-xs">{s.category}</td>
                    <td className="py-2 px-2 text-cyan-400">{s.tier}</td>
                    <td className="py-2 px-2 text-red-400 font-bold">{s.wrongCount}</td>
                    <td className="py-2 px-2 text-yellow-400">{s.avgConfidence ? `${s.avgConfidence}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {playerPatterns.length > 0 && (
        <Section title="Player Knowledge Gaps" icon={Eye} color="text-pink-400">
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-mono">
              <thead>
                <tr className="border-b border-slate-800">
                  {['Player', 'Codename', 'Gap Category', 'Accuracy', 'Attempts'].map((h) => (
                    <th key={h} className="text-left py-2 px-2 text-[10px] uppercase text-slate-500 font-bold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {playerPatterns.map((p: any, i: number) => (
                  <tr key={i} className="border-b border-slate-800/30 hover:bg-white/5">
                    <td className="py-2 px-2 text-slate-400 text-xs max-w-[100px] truncate">{p.playerId}</td>
                    <td className="py-2 px-2 text-white text-xs">{p.codename}</td>
                    <td className="py-2 px-2 text-pink-400">{p.gapCategory}</td>
                    <td className="py-2 px-2 text-red-400 font-bold">{p.gapAccuracy}%</td>
                    <td className="py-2 px-2 text-slate-400">{p.gapAttempts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </div>
  );
};
