import React from 'react';
import { Download, FileText } from 'lucide-react';
import { adminApi } from '../../../api/adminApi';

const EXPORTS = [
  { key: 'leaderboard', label: 'Leaderboard', desc: 'All player rankings and scores' },
  { key: 'player-analytics', label: 'Player Analytics', desc: 'Detailed player session data' },
  { key: 'stimulus-analytics', label: 'Stimulus Analytics', desc: 'Performance metrics per stimulus' },
  { key: 'gameplay-analytics', label: 'Gameplay Analytics', desc: 'All completed game sessions' },
];

export const AdminExports = () => {
  const handleExport = async (key: string) => {
    try {
      await adminApi.exportCsv(key);
    } catch (e) {
      console.error('Export failed', e);
    }
  };

  return (
    <div className="space-y-4">
      <div className="cyber-clip bg-[#0a0515] border border-cyan-500/20 p-4 md:p-6">
        <h3 className="text-sm font-display font-black text-cyan-300 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Download className="w-4 h-4" /> Export Reports (CSV)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {EXPORTS.map((exp) => (
            <div key={exp.key} className="flex items-center justify-between p-4 bg-black/30 border border-slate-800 hover:border-cyan-500/40 transition-colors">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-cyan-400" />
                <div>
                  <div className="text-sm font-bold text-white">{exp.label}</div>
                  <div className="text-xs text-slate-500 font-mono">{exp.desc}</div>
                </div>
              </div>
              <button
                onClick={() => handleExport(exp.key)}
                className="px-4 py-2 text-xs font-bold uppercase tracking-widest cyber-clip bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/30 transition-colors flex items-center gap-2"
              >
                <Download className="w-3.5 h-3.5" /> Export
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
