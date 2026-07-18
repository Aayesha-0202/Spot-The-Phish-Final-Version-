import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, LogOut, Menu, X } from 'lucide-react';
import { useAdminStore } from '../../store/adminStore';
import { AdminOverview } from './sections/AdminOverview';
import { AdminPlayers } from './sections/AdminPlayers';
import { AdminStimuli } from './sections/AdminStimuli';
import { AdminGameAnalytics } from './sections/AdminGameAnalytics';
import { AdminStimulusAnalytics } from './sections/AdminStimulusAnalytics';
import { AdminActivity } from './sections/AdminActivity';
import { AdminLeaderboard } from './sections/AdminLeaderboard';
import { AdminHealth } from './sections/AdminHealth';
import { AdminExports } from './sections/AdminExports';

type Section = 'overview' | 'players' | 'stimuli' | 'game-analytics' | 'stimulus-analytics' | 'activity' | 'leaderboard' | 'health' | 'exports';

const NAV_ITEMS: { key: Section; label: string; icon: string }[] = [
  { key: 'overview', label: 'Overview', icon: '📊' },
  { key: 'players', label: 'Players', icon: '👤' },
  { key: 'stimuli', label: 'Stimuli', icon: '🎯' },
  { key: 'game-analytics', label: 'Game Analytics', icon: '📈' },
  { key: 'stimulus-analytics', label: 'Stimulus Analytics', icon: '🔬' },
  { key: 'activity', label: 'Activity', icon: '📋' },
  { key: 'leaderboard', label: 'Leaderboard', icon: '🏆' },
  { key: 'health', label: 'System Health', icon: '⚙️' },
  { key: 'exports', label: 'Exports', icon: '📥' },
];

export const AdminDashboard = () => {
  const navigate = useNavigate();
  const { username, logout } = useAdminStore();
  const [active, setActive] = useState<Section>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/adminlogin');
  };

  const renderSection = () => {
    switch (active) {
      case 'overview': return <AdminOverview />;
      case 'players': return <AdminPlayers />;
      case 'stimuli': return <AdminStimuli />;
      case 'game-analytics': return <AdminGameAnalytics />;
      case 'stimulus-analytics': return <AdminStimulusAnalytics />;
      case 'activity': return <AdminActivity />;
      case 'leaderboard': return <AdminLeaderboard />;
      case 'health': return <AdminHealth />;
      case 'exports': return <AdminExports />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-cyber-grid bg-[#0d0d1a] text-white flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:sticky top-0 left-0 h-screen w-64 bg-[#0a0515] border-r border-cyan-500/20 z-40 flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-4 border-b border-cyan-500/20">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-cyan-400" />
            <div>
              <div className="text-sm font-display font-black text-cyan-300 uppercase tracking-widest">Admin Panel</div>
              <div className="text-[10px] text-slate-600 font-mono">Spot the Phish</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => { setActive(item.key); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-mono transition-colors ${
                active === item.key
                  ? 'bg-cyan-500/10 text-cyan-300 border-r-2 border-cyan-400'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              <span className="uppercase tracking-wider text-xs font-bold">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-cyan-500/20">
          <div className="text-[10px] text-slate-600 font-mono mb-2">Logged in as {username}</div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2 text-xs uppercase tracking-widest text-pink-400 border border-pink-500/40 hover:bg-pink-500/10 transition-colors cyber-clip"
          >
            <LogOut className="w-3.5 h-3.5" /> Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-[#0d0d1a]/90 backdrop-blur-sm border-b border-cyan-500/20 px-4 py-3 flex items-center gap-4">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden p-2 text-cyan-400 hover:text-white">
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <h2 className="text-lg font-display font-black text-white uppercase tracking-widest">
            {NAV_ITEMS.find((n) => n.key === active)?.icon} {NAV_ITEMS.find((n) => n.key === active)?.label}
          </h2>
        </header>

        <main className="p-4 md:p-6">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {renderSection()}
          </motion.div>
        </main>
      </div>
    </div>
  );
};
