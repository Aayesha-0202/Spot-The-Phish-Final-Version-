import { LeaderboardEntry } from '../models';
import { GameSession } from '../models/GameSession';
import { Player } from '../models/Player';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { recomputeSession, assertScoreIntegrity, type RecomputedScore } from './scoreService';
import type { LeaderboardPeriod } from '../schemas/leaderboardSchema';

// ============================================================================
// IN-MEMORY CACHE for rankedAll() — 30s TTL, invalidated on submit().
// ============================================================================
const CACHE_TTL_MS = 30_000;
const rankedCache = new Map<string, { data: LeaderboardRow[]; expiresAt: number }>();

function cacheKey(period?: LeaderboardPeriod): string {
  return period || 'all';
}

function getCachedRanked(period?: LeaderboardPeriod): LeaderboardRow[] | null {
  const key = cacheKey(period);
  const entry = rankedCache.get(key);
  if (entry && Date.now() < entry.expiresAt) return entry.data;
  rankedCache.delete(key);
  return null;
}

function setCachedRanked(period: LeaderboardPeriod | undefined, data: LeaderboardRow[]): void {
  rankedCache.set(cacheKey(period), { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

function invalidateRankedCache(): void {
  rankedCache.clear();
}

// ============================================================================
// BACKGROUND DEDUP — runs every 60s instead of per-request.
// ============================================================================
let dedupInterval: ReturnType<typeof setInterval> | null = null;

export function startBackgroundDedup(): void {
  if (dedupInterval) return;
  dedupInterval = setInterval(async () => {
    try {
      const dupes = await LeaderboardEntry.aggregate([
        { $group: { _id: '$playerId', count: { $sum: 1 }, docs: { $push: { _id: '$_id', compositeScore: '$compositeScore', updatedAt: '$updatedAt' } } } },
        { $match: { count: { $gt: 1 } } },
      ]);
      for (const g of dupes) {
        const sorted = g.docs.sort((a: any, b: any) =>
          (b.compositeScore - a.compositeScore) || (new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        );
        const idsToDelete = sorted.slice(1).map((d: any) => d._id);
        if (idsToDelete.length) await LeaderboardEntry.deleteMany({ _id: { $in: idsToDelete } });
      }
      if (dupes.length > 0) invalidateRankedCache();
    } catch { /* non-fatal */ }
  }, 60_000);
  // Unref so it doesn't keep the process alive
  if (dedupInterval && typeof dedupInterval === 'object' && 'unref' in dedupInterval) {
    dedupInterval.unref();
  }
}

/** Legacy per-request dedup — now a no-op (background handles it). */
export async function ensureNoDuplicates(): Promise<void> { /* handled by background dedup */ }

export interface LeaderboardRow {
  rank?: number | null;
  _id: string;
  user?: string | null;
  playerId: string;
  /** Codename resolved live from the Player model via $lookup. */
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
  gamesPlayed: number;
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

/** All entries ranked. One entry per user (latest score).
 *  Uses an in-memory cache (30s TTL) to avoid running the heavy aggregation
 *  pipeline on every request. Cache is invalidated on score submission.
 *  A $lookup join on the players collection ensures playerName always reflects
 *  the player's CURRENT codename, not the stale copy stored inside LeaderboardEntry.
 */
async function rankedAll(period?: LeaderboardPeriod): Promise<LeaderboardRow[]> {
  const cached = getCachedRanked(period);
  if (cached) return cached;

  const cutoff = periodCutoff(period);
  const match = cutoff ? { completedAt: { $gte: cutoff } } : {};

  const rows = await LeaderboardEntry.aggregate<LeaderboardRow>([
    { $match: match },
    // Join with players to get the live, current codename.
    {
      $lookup: {
        from: 'players',
        localField: 'playerId',
        foreignField: 'playerId',
        as: '_playerDoc',
      },
    },
    // Replace stored playerName with the live value; fall back to ANONYMOUS if Player is missing.
    {
      $addFields: {
        playerName: {
          $ifNull: [{ $first: '$_playerDoc.name' }, '$playerName', 'ANONYMOUS'],
        },
        // Handle null completionTimeMs — treat as very high (worst) for sorting
        completionTimeMs: { $ifNull: ['$completionTimeMs', 999999999] },
      },
    },
    // Drop the lookup array — not needed in the response.
    { $project: { _playerDoc: 0 } },
    // Group by playerId and keep only the best entry (score desc, then newest)
    { $sort: { compositeScore: -1, updatedAt: -1 } },
    {
      $group: {
        _id: '$playerId',
        bestEntry: { $first: '$$ROOT' },
      },
    },
    { $replaceRoot: { newRoot: '$bestEntry' } },
    // Final sort for the leaderboard ranking
    { $sort: { compositeScore: -1, completionTimeMs: 1, completedAt: 1 } },
  ]);

  const result = rows.map((row, i) => ({
    ...row,
    _id: String(row._id),
    user: row.user ? String(row.user) : null,
    rank: i + 1,
    gamesPlayed: row.gamesPlayed ?? 1,
  }));

  setCachedRanked(period, result);
  return result;
}

export async function top(limit: number, period: LeaderboardPeriod = 'all', offset = 0, currentUserId?: string): Promise<LeaderboardRow[]> {
  const ranked = await rankedAll(period);
  const userIdStr = currentUserId ? String(currentUserId) : undefined;
  return ranked.slice(offset, offset + limit).map((row) => ({
    ...row,
    completionTimeMs: row.completionTimeMs === 999999999 ? undefined : row.completionTimeMs,
    rank: row.rank, // already offset-correct (1-based global)
    isCurrentUser: userIdStr ? row.user === userIdStr || row.playerId === userIdStr : false,
  }));
}

export async function recent(limit = 10, currentUserId?: string): Promise<LeaderboardRow[]> {
  // Use aggregation so we get the live player name via $lookup (same as rankedAll).
  const rows = await LeaderboardEntry.aggregate<LeaderboardRow>([
    {
      $lookup: {
        from: 'players',
        localField: 'playerId',
        foreignField: 'playerId',
        as: '_playerDoc',
      },
    },
    {
      $addFields: {
        playerName: { $ifNull: [{ $first: '$_playerDoc.name' }, '$playerName', 'ANONYMOUS'] },
      },
    },
    { $project: { _playerDoc: 0 } },
    // SAFETY NET: Group by playerId, keep only the most recent entry per player
    { $sort: { updatedAt: -1 } },
    {
      $group: {
        _id: '$playerId',
        bestEntry: { $first: '$$ROOT' },
      },
    },
    { $replaceRoot: { newRoot: '$bestEntry' } },
    { $sort: { completedAt: -1 } },
    { $limit: limit },
  ]);

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
    gamesPlayed: row.gamesPlayed ?? 1,
    isCurrentUser: currentUserId
      ? String(row.user) === String(currentUserId) || row.playerId === String(currentUserId)
      : false,
  }));
}

export async function rankOfUser(userId: string): Promise<{ rank: number | null; totalPlayers: number }> {
  const ranked = await rankedAll();
  const userIdStr = String(userId);
  const idx = ranked.findIndex((r) => r.user === userIdStr || r.playerId === userIdStr);
  return { rank: idx === -1 ? null : idx + 1, totalPlayers: ranked.length };
}

export async function bestScoreOfUser(userId: string): Promise<LeaderboardRow | null> {
  const userIdStr = String(userId);
  // Find ALL entries for this user (may be multiple due to auth-state duplicates)
  // and return the one with the highest score.
  const entries = await LeaderboardEntry.find({ $or: [{ user: userIdStr }, { playerId: userIdStr }] })
    .sort({ compositeScore: -1, updatedAt: -1 })
    .lean();
  if (!entries.length) return null;
  const entry = entries[0];
  // If duplicates exist, clean them up
  if (entries.length > 1) {
    const idsToDelete = entries.slice(1).map((e) => e._id);
    await LeaderboardEntry.deleteMany({ _id: { $in: idsToDelete } }).catch(() => undefined);
  }
  // Fetch live codename from the Player model (single source of truth).
  const playerDoc = await Player.findOne({ playerId: entry.playerId }).lean();
  const liveCodename = playerDoc?.name || 'ANONYMOUS';
  const ranked = await rankedAll();
  const idx = ranked.findIndex((r) => String(r._id) === String(entry._id));
  return {
    _id: String(entry._id),
    user: entry.user ? String(entry.user) : null,
    playerId: entry.playerId,
    playerName: liveCodename,
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
    gamesPlayed: entry.gamesPlayed ?? 1,
    rank: idx === -1 ? null : (idx + 1),
  } as LeaderboardRow;
}

export interface SubmitResult {
  entry: LeaderboardRow;
  recomputed: RecomputedScore;
  isNewBest: boolean;
}

/**
 * Build the canonical upsert filter for a leaderboard entry.
 *
 * ALWAYS includes playerId so that even if auth state differs between
 * requests, the upsert targets the same document — preventing duplicates.
 *
 * Authenticated users  → { user, playerId } (satisfies partial unique index on { user })
 * Guest users          → { playerId, user: null } (satisfies partial unique index on { playerId } filtered to user: null)
 *
 * IMPORTANT: For guests we use `{ user: null }` (not `$exists: false`).
 */
function buildUpsertFilter(userId: string | null | undefined, playerId: string): Record<string, unknown> {
  if (userId) {
    return { user: userId, playerId };
  }
  return { playerId, user: null };
}

/**
 * Remove any duplicate leaderboard entries for this player.
 * Uses ONLY playerId (no auth split) to guarantee all duplicates are caught.
 * Keeps the entry with the highest compositeScore; ties broken by most recent.
 */
async function removeDuplicates(userId: string | null | undefined, playerId: string): Promise<void> {
  try {
    // Find ALL entries for this playerId — regardless of auth state
    const allForPlayer = await LeaderboardEntry.find({ playerId })
      .sort({ compositeScore: -1, updatedAt: -1 })
      .lean();
    if (allForPlayer.length > 1) {
      // Keep the first (highest score / most recent); delete the rest
      const idsToDelete = allForPlayer.slice(1).map((d) => d._id);
      await LeaderboardEntry.deleteMany({ _id: { $in: idsToDelete } });
      logger.info(`[dedup] Removed ${idsToDelete.length} duplicate(s) for player ${playerId}`);
    }

    // Also check by userId if authenticated (handles cross-playerId duplicates under same account)
    if (userId) {
      const allForUser = await LeaderboardEntry.find({ user: userId })
        .sort({ compositeScore: -1, updatedAt: -1 })
        .lean();
      if (allForUser.length > 1) {
        const idsToDelete = allForUser.slice(1).map((d) => d._id);
        await LeaderboardEntry.deleteMany({ _id: { $in: idsToDelete } });
      }
    }
  } catch {
    // Non-fatal — don't block the submit if cleanup fails.
  }
}

/**
 * Submit a completed session to the leaderboard. Server-recomputes the score
 * (anti-cheat). The session MUST be in `completed` status — we do NOT silently
 * force completion here, which prevents 0-score placeholder entries.
 */
export async function submit(sessionId: string, userId?: string | null, clientScore?: number): Promise<SubmitResult> {
  const session = await GameSession.findOne({ sessionId });
  if (!session) throw ApiError.notFound('Session not found');

  // Guard: only accept fully completed sessions. This prevents zero-score
  // entries created from in-progress or abandoned sessions.
  if (session.status !== 'completed') {
    throw ApiError.badRequest('Session is not completed — finish the game before submitting to the leaderboard');
  }

  // Ownership: the game session must belong to the authenticated user.
  // Also check via the Player's user link (session.user may be null if created before auth).
  if (userId) {
    let ownsSession = session.user && String(session.user) === userId;
    if (!ownsSession) {
      const player = await Player.findOne({ playerId: session.playerId }).lean();
      ownsSession = !!(player?.user && String(player.user) === userId);
      // If the player has no user link but the session belongs to this player, allow the
      // authenticated submitter to claim it (handles guest-played-then-logged-in flow).
      if (!ownsSession && !player?.user) {
        ownsSession = true;
        await Player.updateOne({ playerId: session.playerId }, { $set: { user: userId } }).catch(() => undefined);
      }
    }
    // If the session lacks a user link but the player is linked to this user, fix it.
    if (ownsSession && !session.user) {
      session.user = userId as any;
      await session.save();
    }
    if (!ownsSession) {
      throw ApiError.forbidden('This session does not belong to you');
    }
  }

  const recomputed = await recomputeSession(sessionId);
  assertScoreIntegrity(sessionId, clientScore, recomputed);

  // --- Guest migration: if an authenticated user previously played as guest,
  // migrate and delete the old guest entry before creating the user-keyed one.
  if (userId) {
    const guestEntry = await LeaderboardEntry.findOne({
      playerId: session.playerId,
      user: null,
    }).lean();
    if (guestEntry) {
      await LeaderboardEntry.deleteOne({ _id: guestEntry._id });
    }
  }

  // --- Aggressive de-duplicate: find ALL leaderboard entries for this player
  //     (regardless of auth state) and keep only the best one.
  //     This closes the gap where auth-state differences bypass partial indexes.
  await removeDuplicates(userId, session.playerId);

  // --- Build the canonical filter (always includes playerId)
  const upsertFilter = buildUpsertFilter(userId, session.playerId);

  // One final safety check: if duplicates still exist after cleanup, delete them
  // using a broad playerId-only filter before the upsert.
  const remaining = await LeaderboardEntry.find({ playerId: session.playerId }).lean();
  if (remaining.length > 1) {
    // Sort by compositeScore descending, keep the best
    const sorted = remaining.sort((a, b) => (b.compositeScore - a.compositeScore) || (new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
    const idsToDelete = sorted.slice(1).map((d) => d._id);
    await LeaderboardEntry.deleteMany({ _id: { $in: idsToDelete } });
  }

  const existing = await LeaderboardEntry.findOne(upsertFilter).lean();
  const previousScore = existing?.compositeScore ?? 0;

  // Only update the leaderboard if this session's score is BETTER than the existing one.
  // This prevents overwriting a high score with a lower one from a later game.
  const isNewBest = recomputed.compositeScore > previousScore;

  let entry;
  if (isNewBest || !existing) {
    entry = await LeaderboardEntry.findOneAndUpdate(
      upsertFilter,
      {
        $set: {
          user: userId || null,
          playerId: session.playerId,
          sessionId,
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
        $inc: { gamesPlayed: 1 },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } else {
    // Not a new best — just increment gamesPlayed, keep existing score and data.
    entry = await LeaderboardEntry.findOneAndUpdate(
      upsertFilter,
      { $inc: { gamesPlayed: 1 } },
      { new: true }
    );
  }

  if (!entry) {
    throw new Error('Failed to create or update leaderboard entry');
  }

  // Invalidate the ranked cache so the next leaderboard read picks up the new score.
  invalidateRankedCache();

  // Fetch the live codename from the Player model (single source of truth).
  const playerDoc = await Player.findOne({ playerId: session.playerId }).lean();
  const liveCodename = playerDoc?.name || 'ANONYMOUS';

  const ranked = await rankedAll();
  const rank = ranked.findIndex((r) => String(r._id) === String(entry._id)) + 1;

  return {
    entry: {
      _id: String(entry._id),
      user: entry.user ? String(entry.user) : null,
      playerId: entry.playerId,
      playerName: liveCodename,
      sessionId: entry.sessionId,
      compositeScore: entry.compositeScore,
      designation: entry.designation,
      readinessLevel: entry.readinessLevel,
      highestStreak: entry.highestStreak,
      stimuliCorrect: entry.stimuliCorrect,
      stimuliIncorrect: entry.stimuliIncorrect,
      avgResponseTimeMs: entry.avgResponseTimeMs,
      completedAt: entry.completedAt,
      gamesPlayed: entry.gamesPlayed ?? 1,
      rank: rank || null,
    } as LeaderboardRow,
    recomputed,
    isNewBest,
  };
}

export const leaderboardTopMax = env.LEADERBOARD_TOP_MAX;

/**
 * One-time startup cleanup: remove ALL duplicate leaderboard entries.
 * Keeps the entry with the highest compositeScore per playerId (ties broken by most recent).
 * This runs on server boot so the database is clean before the unique index
 * can be reliably enforced.
 */
export async function deduplicateLeaderboard(): Promise<void> {
  try {
    // Group by playerId, find duplicates
    const duplicates = await LeaderboardEntry.aggregate([
      { $group: { _id: '$playerId', count: { $sum: 1 }, docs: { $push: { _id: '$_id', compositeScore: '$compositeScore', updatedAt: '$updatedAt' } } } },
      { $match: { count: { $gt: 1 } } },
    ]);

    if (duplicates.length === 0) {
      logger.info('[dedup] No leaderboard duplicates found');
      return;
    }

    let totalDeleted = 0;
    for (const group of duplicates) {
      // Sort by compositeScore descending, then updatedAt descending — keep the best
      const sorted = group.docs.sort((a: any, b: any) =>
        (b.compositeScore - a.compositeScore) || (new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      );
      const idsToDelete = sorted.slice(1).map((d: any) => d._id);
      if (idsToDelete.length > 0) {
        await LeaderboardEntry.deleteMany({ _id: { $in: idsToDelete } });
        totalDeleted += idsToDelete.length;
      }
    }

    logger.info(`[dedup] Cleaned ${totalDeleted} duplicate leaderboard entries across ${duplicates.length} players`);

    // Drop old partial indexes and recreate all indexes from scratch.
    // syncIndexes() drops indexes not in the schema and creates missing ones.
    await LeaderboardEntry.syncIndexes();
    logger.info('[dedup] Leaderboard indexes rebuilt');
  } catch (err) {
    logger.error('[dedup] Leaderboard deduplication failed:', (err as Error).message);
  }
}
