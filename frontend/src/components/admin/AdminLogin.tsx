import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, Lock, User, AlertTriangle, Loader2 } from 'lucide-react';
import { useAdminStore } from '../../store/adminStore';
import logoUrl from '../../assets/Zetheta Logo.png';

export const AdminLoginScreen = () => {
  const navigate = useNavigate();
  const { login } = useAdminStore();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!identifier.trim() || !password.trim()) {
      setError('Username and password are required');
      return;
    }
    setLoading(true);
    try {
      await login(identifier.trim(), password);
      navigate('/admin');
    } catch (err) {
      setError('Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-cyber-grid bg-[#0d0d1a] px-4">
      <div className="absolute top-0 w-full h-2 bg-gradient-to-r from-pink-500 via-cyan-400 to-yellow-400 opacity-80" />

      <div className="absolute -top-6 left-6 md:-top-6 md:left-12 z-20 p-2">
        <img src={logoUrl} alt="ZeTheta Logo" className="w-44 h-44 md:w-72 md:h-72 object-contain" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-2 border-b-2 border-cyan-400 px-4 py-1 uppercase tracking-[0.3em] text-xs font-black text-cyan-300 font-display mb-4">
            <Shield className="w-3.5 h-3.5" /> Admin Access
          </div>
          <h1 className="text-3xl font-display font-black text-white uppercase tracking-widest cyber-glow-text">
            Administrator Login
          </h1>
          <p className="text-cyan-300/60 font-mono text-sm mt-2">Secure access to the admin dashboard</p>
        </div>

        <div className="cyber-clip-lg bg-[#0a0515] border-2 border-cyan-500/40 p-8 cyber-glow">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="flex items-center gap-2 p-3 border border-red-500/50 bg-red-500/10 text-red-300 text-sm font-mono cyber-clip"
              >
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {error}
              </motion.div>
            )}

            <div>
              <label className="block text-xs uppercase tracking-widest text-slate-500 font-bold mb-2">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400/60" />
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Enter admin username"
                  className="w-full bg-black/50 border border-cyan-500/40 text-white placeholder-slate-600 pl-10 pr-4 p-3 text-sm font-mono focus:border-cyan-400 outline-none cyber-clip"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-widest text-slate-500 font-bold mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400/60" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full bg-black/50 border border-cyan-500/40 text-white placeholder-slate-600 pl-10 pr-4 p-3 text-sm font-mono focus:border-cyan-400 outline-none cyber-clip"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 cyber-clip bg-cyan-500 text-black text-lg tracking-[0.2em] font-display uppercase font-black hover:bg-cyan-400 transition-all cyber-glow flex justify-center items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Shield className="w-5 h-5" /> Access Dashboard
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => navigate('/auth/login')}
              className="text-xs uppercase tracking-widest text-slate-500 hover:text-cyan-300 font-mono transition-colors"
            >
              ← Back to Player Login
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
