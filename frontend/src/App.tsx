import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Trophy, LogOut } from 'lucide-react';
import { useGameStore } from './store/gameStore';
import { useAuthStore } from './store/authStore';
import { LobbyScreen } from './components/screens/LobbyScreen';
import { PlayScreen } from './components/screens/PlayScreen';
import { InterRoundScreen } from './components/screens/InterRoundScreen';
import { ResultsScreen, ComputingScreen } from './components/screens/ResultsScreen';
import { LeaderboardScreen } from './components/screens/LeaderboardScreen';
import { LoginScreen, SignupScreen, ForgotPasswordScreen, ResetPasswordScreen } from './components/auth/AuthScreens';
import { GamePhase } from './types';

/** The phase-driven game (unchanged state machine). */
function Game() {
  const phase = useGameStore((s) => s.phase) as GamePhase;

  const renderScreen = () => {
    switch (phase) {
      case 'LOBBY':
        return <LobbyScreen key="lobby" />;
      case 'TUTORIAL':
      case 'PLAYING':
      case 'INVESTIGATION_REVIEW':
        return <PlayScreen key="play" />;
      case 'INTER_ROUND':
        return <InterRoundScreen key="inter" />;
      case 'COMPUTING':
        return <ComputingScreen key="compute" />;
      case 'RESULTS':
        return <ResultsScreen key="results" />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen w-full font-sans antialiased text-white relative">
      <GameNav />
      <AnimatePresence mode="wait">
        <motion.div
          key={phase}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="w-full min-h-screen"
        >
          {renderScreen()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** Floating nav: leaderboard + logout (authed) or login (guest). */
function GameNav() {
  const navigate = useNavigate();
  const { isAuthenticated, isGuest, user, logout, clearGuest } = useAuthStore();
  const resetGame = useGameStore((s) => s.resetGame);

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
      <button
        onClick={() => navigate('/leaderboard')}
        className="flex items-center gap-1.5 px-3 py-2 text-[10px] uppercase tracking-widest font-bold text-cyan-300 bg-[#0d0d1a]/80 border border-cyan-500/40 hover:bg-cyan-500/20 cyber-clip transition-colors"
      >
        <Trophy className="w-3.5 h-3.5" /> Leaderboard
      </button>
      {isAuthenticated ? (
        <button
          onClick={async () => {
            resetGame();
            await logout();
            navigate('/auth/login');
          }}
          className="flex items-center gap-1.5 px-3 py-2 text-[10px] uppercase tracking-widest font-bold text-pink-300 bg-[#0d0d1a]/80 border border-pink-500/40 hover:bg-pink-500/20 cyber-clip transition-colors"
          title={user?.email}
        >
          <LogOut className="w-3.5 h-3.5" /> Logout
        </button>
      ) : isGuest ? (
        <button
          onClick={() => {
            clearGuest();
            resetGame();
            navigate('/auth/login');
          }}
          className="flex items-center gap-1.5 px-3 py-2 text-[10px] uppercase tracking-widest font-bold text-slate-300 bg-[#0d0d1a]/80 border border-slate-600 hover:bg-slate-700 cyber-clip transition-colors"
        >
          Login
        </button>
      ) : null}
    </div>
  );
}

/** Gate the game behind auth (guests allowed via Continue as Guest). */
function GameGate() {
  const { isAuthenticated, isGuest, booted } = useAuthStore();
  if (!booted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0d0d1a] bg-cyber-grid">
        <div className="text-cyan-400 font-display tracking-[0.3em] uppercase animate-pulse">Initializing...</div>
      </div>
    );
  }
  if (!isAuthenticated && !isGuest) {
    return <Navigate to="/auth/login" replace />;
  }
  return <Game />;
}

export default function App() {
  const boot = useAuthStore((s) => s.boot);

  useEffect(() => {
    boot();
  }, [boot]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth/login" element={<LoginScreen />} />
        <Route path="/auth/signup" element={<SignupScreen />} />
        <Route path="/auth/forgot-password" element={<ForgotPasswordScreen />} />
        <Route path="/auth/reset-password" element={<ResetPasswordScreen />} />
        <Route path="/leaderboard" element={<LeaderboardScreen />} />
        <Route path="/*" element={<GameGate />} />
      </Routes>
    </BrowserRouter>
  );
}
