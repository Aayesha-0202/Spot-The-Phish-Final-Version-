import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Gamepad2, Target, Clock, TrendingUp, TrendingDown, Activity, Zap, BarChart3 } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { adminApi } from '../../../api/adminApi';

function StatCard({ icon: Icon, label, value, color = 'text-cyan-400', sub }: { icon: any; label: string; value: string | number; color?: string; sub?: string }) {
  return (
    <div className="cyber-clip bg-[#0a0515] border border-cyan-500/20 p-4 md:p-5">
      <div className="flex items-center gap-3 mb-2">
        <Icon className={`w-5 h-5 ${color}`} />
        <span className="text-[11px] uppercase tracking-widest text-slate-500 font-bold">{label}</span>
      </div>
      <div className="text-2xl md:text-3xl font-mono font-black text-white">{value}</div>
      {sub && <div className="text-[11px] text-slate-600 font-mono mt-1">{sub}</div>}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="cyber-clip bg-[#0a0515] border border-cyan-500/20 p-4 md:p-6">
      <h3 className="text-sm font-display font-black text-cyan-300 uppercase tracking-widest mb-4">{title}</h3>
      {children}
    </div>
  );
}

export const AdminOverview = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getOverview().then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><div className="text-cyan-400 font-mono animate-pulse">Loading...</div></div>;
  if (!data) return <div className="text-red-400 font-mono py-20 text-center">Failed to load overview</div>;

  const { summary: s, charts: c } = data;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard icon={Users} label="Total Players" value={s.totalPlayers} color="text-cyan-400" />
        <StatCard icon={Activity} label="Active Today" value={s.activeToday} color="text-green-400" />
        <StatCard icon={TrendingUp} label="Active This Week" value={s.activeWeek} color="text-yellow-400" />
        <StatCard icon={BarChart3} label="Active This Month" value={s.activeMonth} color="text-pink-400" />
        <StatCard icon={Gamepad2} label="Games Played" value={s.totalGamesPlayed} color="text-cyan-400" />
        <StatCard icon={Target} label="Stimuli Viewed" value={s.totalStimuliViewed} color="text-purple-400" />
        <StatCard icon={Zap} label="Avg Score" value={s.averageScore} color="text-yellow-400" sub="points" />
        <StatCard icon={Activity} label="Avg Accuracy" value={`${s.averageAccuracy}%`} color="text-green-400" />
        <StatCard icon={Clock} label="Avg Time" value={s.averageCompletionTime ? `${Math.round(s.averageCompletionTime / 1000)}s` : '—'} color="text-pink-400" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ChartCard title="Daily Players (30 days)">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={c.dailyPlayers}>
                <CartesianGrid stroke="rgba(34,211,238,0.1)" />
                <XAxis dataKey="_id" tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: '#0d0d1a', border: '1px solid rgba(34,211,238,0.4)', color: '#fff', fontSize: 12 }} />
                <Area type="monotone" dataKey="count" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Games Played Trend (30 days)">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={c.gamesTrend}>
                <CartesianGrid stroke="rgba(34,211,238,0.1)" />
                <XAxis dataKey="_id" tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: '#0d0d1a', border: '1px solid rgba(34,211,238,0.4)', color: '#fff', fontSize: 12 }} />
                <Bar dataKey="count" fill="#ec4899" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Average Score Trend (30 days)">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={c.scoreTrend}>
                <CartesianGrid stroke="rgba(34,211,238,0.1)" />
                <XAxis dataKey="_id" tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: '#0d0d1a', border: '1px solid rgba(34,211,238,0.4)', color: '#fff', fontSize: 12 }} />
                <Area type="monotone" dataKey="avgScore" stroke="#facc15" fill="#facc15" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Accuracy Trend (30 days)">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={c.accuracyTrend}>
                <CartesianGrid stroke="rgba(34,211,238,0.1)" />
                <XAxis dataKey="_id" tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} domain={[0, 100]} />
                <Tooltip contentStyle={{ background: '#0d0d1a', border: '1px solid rgba(34,211,238,0.4)', color: '#fff', fontSize: 12 }} />
                <Area type="monotone" dataKey="avgAccuracy" stroke="#4ade80" fill="#4ade80" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>
    </div>
  );
};
