import { api, unwrap, type Envelope } from './client';

export interface LeaderboardRow {
  rank?: number | null;
  _id: string;
  user?: string | null;
  playerId: string;
  playerName: string;
  sessionId: string;
  compositeScore: number;
  designation?: string;
  readinessLevel?: string;
  highestStreak: number;
  stimuliCorrect: number;
  stimuliIncorrect: number;
  avgResponseTimeMs?: number;
  completionTimeMs?: number;
  completedAt: string;
  isCurrentUser?: boolean;
}

export type LeaderboardPeriod = 'today' | 'week' | 'month' | 'all';

export const leaderboardApi = {
  top: (limit = 10, period: LeaderboardPeriod = 'all', offset = 0) =>
    unwrap<{ entries: LeaderboardRow[]; period: string }>(
      api.get<Envelope<{ entries: LeaderboardRow[]; period: string }>>(
        `/leaderboard/top?limit=${limit}&period=${period}&offset=${offset}`
      )
    ),
  recent: (limit = 10) =>
    unwrap<{ entries: LeaderboardRow[] }>(api.get<Envelope<{ entries: LeaderboardRow[] }>>(`/leaderboard/recent?limit=${limit}`)),
  byPeriod: (period: LeaderboardPeriod) =>
    unwrap<{ entries: LeaderboardRow[]; period: string }>(
      api.get<Envelope<{ entries: LeaderboardRow[]; period: string }>>(`/leaderboard/by-period?period=${period}`)
    ),
  myRank: () => unwrap<{ rank: number | null; totalPlayers: number }>(api.get<Envelope<{ rank: number | null; totalPlayers: number }>>('/leaderboard/rank')),
  myBest: () => unwrap<{ entry: LeaderboardRow | null }>(api.get<Envelope<{ entry: LeaderboardRow | null }>>('/leaderboard/best')),
  submit: (sessionId: string, clientScore?: number) =>
    unwrap<{ entry: LeaderboardRow; recomputed: { compositeScore: number }; isNewBest: boolean }>(
      api.post<Envelope<{ entry: LeaderboardRow; recomputed: { compositeScore: number }; isNewBest: boolean }>>(
        '/leaderboard/submit',
        { sessionId, clientScore }
      )
    ),
};
