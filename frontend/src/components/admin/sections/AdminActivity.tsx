import React, { useEffect, useState } from 'react';
import { Clock, User, Trophy, Gamepad2 } from 'lucide-react';
import { adminApi } from '../../../api/adminApi';

export const AdminActivity = () => {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { adminApi.getActivity(50).then(setActivities).catch(console.error).finally(() => setLoading(false)); }, []);

  if (loading) return <div className="flex justify-center py-20"><div className="text-cyan-400 font-mono animate-pulse">Loading...</div></div>;

  return (
    <div className="space-y-4">
      <div className="cyber-clip bg-[#0a0515] border border-cyan-500/20 p-4 md:p-6">
        <h3 className="text-sm font-display font-black text-cyan-300 uppercase tracking-widest mb-4">Recent Activity Feed</h3>
        {activities.length === 0 ? (
          <div className="text-slate-500 text-sm font-mono text-center py-8">No recent activity</div>
        ) : (
          <div className="space-y-3">
            {activities.map((a, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-black/30 border border-slate-800/50 hover:bg-white/5 transition-colors">
                <div className="w-8 h-8 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white">
                    <span className="font-bold text-cyan-300">{a.codename}</span>
                    <span className="text-slate-400 ml-2">{a.action}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] text-slate-600 font-mono flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {new Date(a.timestamp).toLocaleString()}
                    </span>
                    {a.score > 0 && (
                      <span className="text-[10px] text-yellow-400 font-mono flex items-center gap-1">
                        <Trophy className="w-3 h-3" /> {a.score} pts
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
