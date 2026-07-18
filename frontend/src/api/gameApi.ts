import { api } from './client';

/**
 * Backend API methods. All calls are best-effort from the store's perspective —
 * failures are caught so the UI keeps working even if the backend is offline.
 */
export const gameApi = {
  // Players
  upsertPlayer: (playerId: string, name: string, email?: string, userId?: string) =>
    api.post('/players', { playerId, name, email, userId }),
  getPlayer: (playerId: string) => api.get(`/players/${playerId}`),
  getPlayerByUserId: (userId: string) => api.get(`/players/by-user/${userId}`),
  updatePlayer: (playerId: string, name: string) =>
    api.patch(`/players/${playerId}`, { name }),
  getPlayerProfile: (playerId: string) => api.get(`/players/${playerId}/profile`),

  // Sessions
  startSession: (sessionId: string, playerId: string) =>
    api.post('/sessions/start', { sessionId, playerId }),
  recordAttempt: (
    sessionId: string,
    data: {
      stimulusId: string;
      category: string;
      tier: number;
      roundNumber?: number;
      playerChoice?: string;
      correctAnswer?: unknown;
      investigations?: unknown;
      isCorrect: boolean;
      scoreAwarded: number;
      responseTimeMs?: number;
    }
  ) => api.post(`/sessions/${sessionId}/attempts`, data),
  saveProgress: (
    sessionId: string,
    data: {
      totalScore?: number;
      completedLevels?: number;
      livesRemaining?: number;
      streakAchieved?: number;
      stimuliAttempted?: number;
    }
  ) => api.patch(`/sessions/${sessionId}/progress`, data),
  finishSession: (sessionId: string, data: Record<string, unknown>) =>
    api.post(`/sessions/${sessionId}/finish`, data),
  getSession: (sessionId: string) => api.get(`/sessions/${sessionId}`),
  listSessions: (playerId: string) => api.get(`/sessions?playerId=${playerId}`),

  // Results
  saveReport: (sessionId: string, data: Record<string, unknown>) =>
    api.post(`/sessions/${sessionId}/report`, data),
  getReport: (sessionId: string) => api.get(`/sessions/${sessionId}/report`),
  getDownloadMetadata: (sessionId: string) =>
    api.get(`/sessions/${sessionId}/report/download`),

  // Email — auto-send the finished report (PNG + optional PDF). No extra click.
  emailReport: (
    sessionId: string,
    data: {
      compositeScore?: number;
      designation?: string;
      reportSummary?: string;
      strengths?: string[];
      weaknesses?: string[];
      readinessLevel?: string;
      threatsCaughtPct?: number;
      pngBase64: string;
    }
  ) => api.post(`/sessions/${sessionId}/email-report`, data),

  // Leaderboard — submit a completed session (server re-scores; anti-cheat).
  submitLeaderboard: (sessionId: string, clientScore?: number) =>
    api.post(`/leaderboard/submit`, { sessionId, clientScore }),

  // Analytics
  overallAnalytics: () => api.get('/analytics/overall'),
  categoryAnalytics: () => api.get('/analytics/categories'),
  tierAnalytics: () => api.get('/analytics/tiers'),
  leaderboard: (limit = 10) => api.get(`/analytics/leaderboard?limit=${limit}`),

  // Gameplay Rotation System
  generateGameplay: (playerId: string) =>
    api.post('/gameplay/generate', { playerId }),
  getPlayerHistory: (playerId: string) =>
    api.get(`/gameplay/history/${playerId}`),
  getAllPlayersHistory: () =>
    api.get('/gameplay/admin/players'),
  resetPlayerHistory: (playerId: string) =>
    api.delete(`/gameplay/history/${playerId}`),
};
