import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck, Crosshair, LogIn, UserPlus, Mail, Lock, User, ArrowLeft, AlertTriangle, CheckCircle } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

/* ------------------------------------------------------------------ */
/* Official Google Identity Services button → posts credential to API   */
/* ------------------------------------------------------------------ */
function GoogleButton() {
  const ref = useRef<HTMLDivElement>(null);
  const googleLogin = useAuthStore((s) => s.googleLogin);
  const navigate = useNavigate();
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !ref.current) return;
    const SCRIPT_ID = 'google-gsi';
    const init = () => {
      const g = (window as any).google;
      if (!g?.accounts?.id) {
        setTimeout(init, 200);
        return;
      }
      g.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (resp: any) => {
          if (!resp?.credential) return;
          try {
            await googleLogin(resp.credential);
            navigate('/');
          } catch (e) {
            console.error('Google login failed', e);
          }
        },
      });
      g.accounts.id.renderButton(ref.current, { theme: 'outline', size: 'large', width: 320, text: 'continue_with' });
      setAvailable(true);
    };

    if (!document.getElementById(SCRIPT_ID)) {
      const s = document.createElement('script');
      s.id = SCRIPT_ID;
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.defer = true;
      s.onload = init;
      document.body.appendChild(s);
    } else {
      init();
    }
  }, [googleLogin, navigate]);

  if (!GOOGLE_CLIENT_ID) {
    return <p className="text-center text-[10px] uppercase tracking-widest text-slate-500 font-mono">Google login not configured</p>;
  }
  return <div ref={ref} className="flex justify-center min-h-[40px]" style={{ opacity: available ? 1 : 0.4 }} />;
}

/* ------------------------------------------------------------------ */
/* Shared cyber shell                                                   */
/* ------------------------------------------------------------------ */
function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  const navigate = useNavigate();
  const continueAsGuest = useAuthStore((s) => s.continueAsGuest);
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-12 relative z-10 bg-cyber-grid bg-[#0d0d1a]">
      <div className="absolute top-0 w-full h-2 bg-gradient-to-r from-pink-500 via-cyan-400 to-yellow-400 opacity-80" />

      <div className="absolute top-5 left-5 md:top-8 md:left-10 z-20 flex items-center gap-2">
        <div className="relative w-12 h-12 cyber-clip bg-[#0d0d1a] border-2 border-cyan-400 cyber-glow flex items-center justify-center">
          <ShieldCheck className="w-6 h-6 text-cyan-400" strokeWidth={2.5} />
          <Crosshair className="w-3.5 h-3.5 text-pink-500 -ml-2 -mb-2.5" strokeWidth={2.5} />
        </div>
        <span className="font-display font-black tracking-[0.3em] text-cyan-300 text-sm uppercase">Spot the Phish</span>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md cyber-clip-lg bg-[#0d0d1a] border-2 border-cyan-400 cyber-glow p-8 md:p-10"
      >
        <h1 className="text-3xl font-display font-black text-white uppercase tracking-widest mb-1">{title}</h1>
        <p className="text-cyan-100/60 text-sm font-mono mb-6">{subtitle}</p>

        {children}

        <div className="my-6 flex items-center gap-3">
          <div className="flex-1 h-px bg-slate-700" />
          <span className="text-[10px] uppercase tracking-widest text-slate-500 font-mono">or</span>
          <div className="flex-1 h-px bg-slate-700" />
        </div>

        <GoogleButton />

        <button
          onClick={() => {
            continueAsGuest();
            navigate('/');
          }}
          className="mt-4 w-full py-3 text-xs tracking-[0.2em] uppercase font-bold text-slate-400 border border-slate-700 hover:bg-slate-800 hover:text-white justify-center flex cyber-clip transition-colors"
        >
          Continue as Guest
        </button>
      </motion.div>
    </div>
  );
}

function Field({ icon, ...props }: { icon: React.ReactNode } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400/70">{icon}</span>
      <input
        {...props}
        className="w-full bg-black/50 border border-cyan-500/40 text-white placeholder-slate-500 p-3 pl-10 text-sm font-mono focus:border-cyan-400 outline-none cyber-clip"
      />
    </div>
  );
}

function Feedback({ error, success }: { error?: string; success?: string }) {
  if (error) return <p className="flex items-center gap-2 text-red-400 text-xs font-mono mt-2"><AlertTriangle className="w-4 h-4" />{error}</p>;
  if (success) return <p className="flex items-center gap-2 text-green-400 text-xs font-mono mt-2"><CheckCircle className="w-4 h-4" />{success}</p>;
  return null;
}

/* ------------------------------------------------------------------ */
/* Screens                                                              */
/* ------------------------------------------------------------------ */
export const LoginScreen = () => {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError((err as Error).message.replace(/^API.*→\s*\d+:\s*/, ''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Access Terminal" subtitle="Authenticate to enter the assessment module.">
      <form onSubmit={submit} className="space-y-4">
        <Field icon={<Mail className="w-4 h-4" />} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Field icon={<Lock className="w-4 h-4" />} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <div className="flex justify-end">
          <Link to="/auth/forgot-password" className="text-xs text-pink-300/80 hover:text-pink-200 font-mono">Forgot password?</Link>
        </div>
        <Feedback error={error} />
        <button type="submit" disabled={loading} className="w-full cyber-clip py-3 bg-yellow-400 text-black font-display font-black uppercase tracking-widest hover:bg-yellow-300 disabled:opacity-60 flex justify-center items-center gap-2 transition-all cyber-glow-yellow">
          <LogIn className="w-5 h-5" /> {loading ? 'Authenticating...' : 'Login'}
        </button>
      </form>
      <p className="mt-6 text-center text-xs font-mono text-slate-400">
        No account? <Link to="/auth/signup" className="text-cyan-400 hover:text-cyan-300">Create one</Link>
      </p>
    </AuthShell>
  );
};

export const SignupScreen = () => {
  const navigate = useNavigate();
  const register = useAuthStore((s) => s.register);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await register(username, email, password);
      navigate('/');
    } catch (err) {
      setError((err as Error).message.replace(/^API.*→\s*\d+:\s*/, ''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="New Operator" subtitle="Register a codename to track your scores on the leaderboard.">
      <form onSubmit={submit} className="space-y-4">
        <Field icon={<User className="w-4 h-4" />} placeholder="Codename" value={username} onChange={(e) => setUsername(e.target.value)} required />
        <Field icon={<Mail className="w-4 h-4" />} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Field icon={<Lock className="w-4 h-4" />} type="password" placeholder="Password (min 8 chars)" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <Feedback error={error} />
        <button type="submit" disabled={loading} className="w-full cyber-clip py-3 bg-yellow-400 text-black font-display font-black uppercase tracking-widest hover:bg-yellow-300 disabled:opacity-60 flex justify-center items-center gap-2 transition-all cyber-glow-yellow">
          <UserPlus className="w-5 h-5" /> {loading ? 'Creating...' : 'Create Account'}
        </button>
      </form>
      <p className="mt-6 text-center text-xs font-mono text-slate-400">
        Already registered? <Link to="/auth/login" className="text-cyan-400 hover:text-cyan-300">Login</Link>
      </p>
    </AuthShell>
  );
};

export const ForgotPasswordScreen = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const { authApi } = await import('../../api/authApi');
      await authApi.forgotPassword(email);
      setSuccess('If that email exists, a reset link has been sent.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Reset Access" subtitle="We'll email you a link to set a new password.">
      <form onSubmit={submit} className="space-y-4">
        <Field icon={<Mail className="w-4 h-4" />} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Feedback error={error} success={success} />
        <button type="submit" disabled={loading} className="w-full cyber-clip py-3 bg-yellow-400 text-black font-display font-black uppercase tracking-widest hover:bg-yellow-300 disabled:opacity-60 flex justify-center items-center gap-2 transition-all cyber-glow-yellow">
          <Mail className="w-5 h-5" /> {loading ? 'Sending...' : 'Send Reset Link'}
        </button>
      </form>
      <p className="mt-6 text-center text-xs font-mono text-slate-400">
        <Link to="/auth/login" className="text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1"><ArrowLeft className="w-3 h-3" /> Back to login</Link>
      </p>
    </AuthShell>
  );
};

export const ResetPasswordScreen = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { authApi } = await import('../../api/authApi');
      await authApi.resetPassword(token, password);
      setSuccess('Password reset — redirecting to login...');
      setTimeout(() => navigate('/auth/login'), 1500);
    } catch (err) {
      setError((err as Error).message.replace(/^API.*→\s*\d+:\s*/, ''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="New Password" subtitle="Choose a new password for your account.">
      <form onSubmit={submit} className="space-y-4">
        {!token && <Feedback error="Missing reset token — use the link from your email." />}
        <Field icon={<Lock className="w-4 h-4" />} type="password" placeholder="New password (min 8 chars)" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={!token} />
        <Feedback error={error} success={success} />
        <button type="submit" disabled={loading || !token} className="w-full cyber-clip py-3 bg-yellow-400 text-black font-display font-black uppercase tracking-widest hover:bg-yellow-300 disabled:opacity-60 flex justify-center items-center gap-2 transition-all cyber-glow-yellow">
          <Lock className="w-5 h-5" /> {loading ? 'Resetting...' : 'Reset Password'}
        </button>
      </form>
    </AuthShell>
  );
};
