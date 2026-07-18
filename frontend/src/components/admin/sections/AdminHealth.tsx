import React, { useEffect, useState } from 'react';
import { Server, Database, Mail, Package, CheckCircle, XCircle, Activity } from 'lucide-react';
import { adminApi } from '../../../api/adminApi';

export const AdminHealth = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { adminApi.getHealth().then(setData).catch(console.error).finally(() => setLoading(false)); }, []);

  if (loading) return <div className="flex justify-center py-20"><div className="text-cyan-400 font-mono animate-pulse">Loading...</div></div>;
  if (!data) return <div className="text-red-400 font-mono py-20 text-center">Failed to load health data</div>;

  const items = [
    { label: 'Backend Status', value: data.backendStatus, icon: Server, ok: data.backendStatus === 'Operational' },
    { label: 'Database Status', value: data.databaseStatus, icon: Database, ok: data.databaseStatus === 'Connected' },
    { label: 'SMTP Status', value: data.smtpStatus, icon: Mail, ok: data.smtpStatus === 'Configured' },
    { label: 'Application Version', value: data.applicationVersion, icon: Package, ok: true },
    { label: 'Total Stimuli', value: data.totalStimuli, icon: Activity, ok: true },
    { label: 'Enabled Stimuli', value: data.enabledStimuli, icon: CheckCircle, ok: true },
    { label: 'Disabled Stimuli', value: data.disabledStimuli, icon: XCircle, ok: data.disabledStimuli === 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => (
          <div key={item.label} className="cyber-clip bg-[#0a0515] border border-cyan-500/20 p-5">
            <div className="flex items-center gap-3 mb-3">
              <item.icon className={`w-5 h-5 ${item.ok ? 'text-green-400' : 'text-yellow-400'}`} />
              <span className="text-xs uppercase tracking-widest text-slate-500 font-bold">{item.label}</span>
            </div>
            <div className="flex items-center gap-2">
              {typeof item.ok === 'boolean' && (
                item.ok ? <CheckCircle className="w-4 h-4 text-green-400" /> : <XCircle className="w-4 h-4 text-yellow-400" />
              )}
              <span className={`text-xl font-mono font-black ${item.ok ? 'text-green-400' : 'text-yellow-400'}`}>{item.value}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
