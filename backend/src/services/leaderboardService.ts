import { LeaderboardEntry } from '../models';
import { GameSession } from '../models/GameSession';
import { Player } from '../models/Player';
import { ApiError } from '../utils/ApiError';
import { env } from '../config/env';
import { recomputeSession, assertScoreIntegrity, type RecomputedScore } from './scoreService';
import type { LeaderboardPeriod } from '../schemas/leaderboardSchema';

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
  completionTimeMs?: number;  // total game duration — used for tiebreaking
  completedAt: Date;
  isCurrentUser?: boolean;
}

function periodCutoff(period?: LeaderboardPeriod): Date | null {
  if (!period || period === 'all') return null;
  const now = new Date();
  if (period === 'today') {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (period === 'week') {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d;
  }
  // month
  const d = new Date(now);
  d.setDate(d.getDate() - 30);
  return d;
}

/** Best entry per user, ranked. Each user appears once (their highest score). */
async function rankedBestPerUser(period?: LeaderboardPeriod): Promise<LeaderboardRow[]> {
  const cutoff = periodCutoff(period);
  const match = cutoff ? { completedAt: { $gte: cutoff } } : {};

  const rows = await LeaderboardEntry.aggregate<LeaderboardRow>([
    { $match: match },
    // Handle null completionTimeMs — treat as very high (worst) for sorting
    { $addFields: { completionTimeMs: { $ifNull: ['$completionTimeMs', 999999999] } } },
    // Best entry per user: highest score, then fastest time.
    { $sort: { compositeScore: -1, completionTimeMs: 1, completedAt: 1 } },
    { $group: { _id: '$user', doc: { $first: '$$ROOT' } } },
    { $replaceRoot: { newRoot: '$doc' } },
    // Re-sort the deduped set.
    { $sort: { compositeScore: -1, completionTimeMs: 1, completedAt: 1 } },
  ]);

  return rows.map((row, i) => ({
    ...row,
    _id: String(row._id),
    user: row.user ? String(row.user) : null,
    rank: i + 1,
  }));
}

export async function top(limit: number, period: LeaderboardPeriod = 'all', offset = 0, currentUserId?: string): Promise<LeaderboardRow[]> {
  const ranked = await rankedBestPerUser(period);
  return ranked.slice(offset, offset + limit).map((row) => ({
    ...row,
    completionTimeMs: row.completionTimeMs === 999999999 ? undefined : row.completionTimeMs,
    rank: row.rank, // already offset-correct (1-based global)
    isCurrentUser: currentUserId ? row.user === currentUserId : false,
  }));
}

export async function recent(limit = 10, currentUserId?: string): Promise<LeaderboardRow[]> {
  const rows = await LeaderboardEntry.find({})
    .sort({ completedAt: -1 })
    .limit(limit)
    .lean();
  return rows.map((row) => ({
    _id: String(row._id),
    user: row.user ? String(row.user) : null,
    playerId: row.playerId,
    playerName: row.playerName,
    sessionId: row.sessionId,
    compositeScore: row.compositeScore,
    designation: row.designation,
    readinessLevel: row.readinessLevel,
    highestStreak: row.highestStreak,
    stimuliCorrect: row.stimuliCorrect,
    stimuliIncorrect: row.stimuliIncorrect,
    avgResponseTimeMs: row.avgResponseTimeMs,
    completionTimeMs: row.completionTimeMs,
    completedAt: row.completedAt,
    isCurrentUser: currentUserId ? String(row.user) === currentUserId : false,
  }));
}

export async function rankOfUser(userId: string): Promise<{ rank: number | null; totalPlayers: number }> {
  const ranked = await rankedBestPerUser();
  const idx = ranked.findIndex((r) => r.user === userId);
  return { rank: idx === -1 ? null : idx + 1, totalPlayers: ranked.length };
}

export async function bestScoreOfUser(userId: string): Promise<LeaderboardRow | null> {
  const entry = await LeaderboardEntry.findOne({ user: userId }).sort({ compositeScore: -1 }).lean();
  if (!entry) return null;
  const ranked = await rankedBestPerUser();
  const idx = ranked.findIndex((r) => String(r._id) === String(entry._id));
  return {
    _id: String(entry._id),
    user: String(entry.user),
    playerId: entry.playerId,
    playerName: entry.playerName,
    sessionId: entry.sessionId,
    compositeScore: entry.compositeScore,
    designation: entry.designation,
    readinessLevel: entry.readinessLevel,
    highestStreak: entry.highestStreak,
    stimuliCorrect: entry.stimuliCorrect,
    stimuliIncorrect: entry.stimuliIncorrect,
    avgResponseTimeMs: entry.avgResponseTimeMs,
    completionTimeMs: entry.completionTimeMs,
    completedAt: entry.completedAt,
    rank: idx === -1 ? null : (idx + 1),
  } as LeaderboardRow;
}

export interface SubmitResult {
  entry: LeaderboardRow;
  recomputed: RecomputedScore;
  isNewBest: boolean;
}

/**
 * Submit a completed session to the leaderboard. Server-recomputes the score
 * (anti-cheat), requires an authenticated session that owns the game session,
 * and only accepts fully-completed (5-level) runs.
 */
export async function submit(sessionId: string, userId: string, clientScore?: number): Promise<SubmitResult> {
  const session = await GameSession.findOne({ sessionId });
  if (!session) throw ApiError.notFound('Session not found');

  // Ownership: the game session must belong to the authenticated user.
  // Also check via the Player's user link (session.user may be null if created before auth).
  let ownsSession = session.user && String(session.user) === userId;
  if (!ownsSession) {
    const player = await Player.findOne({ playerId: session.playerId }).lean();
    ownsSession = !!(player?.user && String(player.user) === userId);
  }
  // If the session lacks a user link but the player is linked to this user, fix it.
  if (ownsSession && !session.user) {
    session.user = userId as any;
    await session.save();
  }
  if (!ownsSession) {
    throw ApiError.forbidden('This session does not belong to you');
  }

  // Completion gate: finished and all 5 levels cleared.
  if (session.status !== 'completed' || session.completedLevels < 5) {
    throw ApiError.unprocessable('Only fully completed assessments (all 5 levels) can be ranked');
  }

  const recomputed = await recomputeSession(sessionId);
  assertScoreIntegrity(sessionId, clientScore, recomputed);

  const player = await Player.findById(session.player).lean();
  const playerName = player?.name || 'ANONYMOUS';

  // Idempotent upsert keyed by unique sessionId (replays update the same entry).
  const entry = await LeaderboardEntry.findOneAndUpdate(
    { sessionId },
    {
      $set: {
        user: userId,
        playerId: session.playerId,
        playerName,
        compositeScore: recomputed.compositeScore,
        designation: session.designation,
        readinessLevel: session.readinessLevel,
        highestStreak: recomputed.highestStreak,
        stimuliCorrect: recomputed.stimuliCorrect,
        stimuliIncorrect: recomputed.stimuliIncorrect,
        avgResponseTimeMs: recomputed.avgResponseTimeMs,
        completionTimeMs: (session as any).completionTimeMs ?? undefined,
        completedAt: session.endTime || new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Is this the player's new best?
  const best = await LeaderboardEntry.findOne({ user: userId }).sort({ compositeScore: -1 }).lean();
  const isNewBest = !!best && String(best._id) === String(entry._id);

  const ranked = await rankedBestPerUser();
  const rank = ranked.findIndex((r) => String(r._id) === String(entry._id)) + 1;

  return {
    entry: {
      _id: String(entry._id),
      user: String(entry.user),
      playerId: entry.playerId,
      playerName: entry.playerName,
      sessionId: entry.sessionId,
      compositeScore: entry.compositeScore,
      designation: entry.designation,
      readinessLevel: entry.readinessLevel,
      highestStreak: entry.highestStreak,
      stimuliCorrect: entry.stimuliCorrect,
      stimuliIncorrect: entry.stimuliIncorrect,
      avgResponseTimeMs: entry.avgResponseTimeMs,
      completedAt: entry.completedAt,
      rank: rank || null,
    } as LeaderboardRow,
    recomputed,
    isNewBest,
  };
}

export const leaderboardTopMax = env.LEADERBOARD_TOP_MAX;
