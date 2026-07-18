import { Player } from '../models/Player';
import { ApiError } from '../utils/ApiError';

interface UpsertPlayerInput {
  playerId: string;
  name: string;
  email?: string;
  userId?: string;
}

/** Create a player, or update name/email/user link if they already exist (idempotent). */
export async function upsertPlayer({ playerId, name, email, userId }: UpsertPlayerInput) {
  const existing = await Player.findOne({ playerId });
  if (existing) {
    let dirty = false;
    if (name && name !== existing.name) { existing.name = name; dirty = true; }
    if (email && email !== existing.email) { existing.email = email; dirty = true; }
    if (userId && String(existing.user) !== userId) { existing.user = userId as any; dirty = true; }
    if (dirty) await existing.save();
    return existing;
  }
  return Player.create({
    playerId,
    name,
    email,
    user: userId || null,
  });
}

export async function getPlayer(playerId: string) {
  const player = await Player.findOne({ playerId });
  if (!player) throw ApiError.notFound('Player not found');
  return player;
}

/** Look up a player by their linked auth user ObjectId. */
export async function getPlayerByUserId(userId: string) {
  const player = await Player.findOne({ user: userId });
  if (!player) throw ApiError.notFound('Player not found');
  return player;
}

export async function updatePlayer(playerId: string, data: { name?: string; email?: string }) {
  const player = await Player.findOneAndUpdate({ playerId }, data, { new: true });
  if (!player) throw ApiError.notFound('Player not found');
  return player;
}

/** Best (highest scoring) completed session for a player, for profile context. */
export async function getPlayerBest(playerId: string) {
  await Player.findOne({ playerId }).lean();
  const { GameSession } = require('../models/GameSession');
  return GameSession.findOne({ playerId, status: 'completed' }).sort({ totalScore: -1 }).lean();
}

/** Full player profile: stats, rank, and recent game history. */
export async function getPlayerProfile(playerId: string) {
  const { GameSession } = require('../models/GameSession');
  const { StimulusAttempt } = require('../models/StimulusAttempt');

  const player = await Player.findOne({ playerId }).lean();

  // For new players who haven't played yet, return empty profile data
  // instead of 404 — the UI will show a "play to get started" message.
  if (!player) {
    return {
      player: { playerId, name: null, email: null, createdAt: null },
      stats: { totalGames: 0, bestScore: 0, avgScore: 0, bestTime: null, stimuliCorrect: 0, stimuliTotal: 0 },
      recentSessions: [],
    };
  }

  // All completed sessions for this player
  const sessions = await GameSession.find({ playerId, status: 'completed' })
    .sort({ endTime: -1 })
    .lean();

  const totalGames = sessions.length;
  const bestScore = sessions.length > 0 ? Math.max(...sessions.map((s: any) => s.totalScore || 0)) : 0;
  const avgScore = totalGames > 0 ? Math.round(sessions.reduce((sum: number, s: any) => sum + (s.totalScore || 0), 0) / totalGames) : 0;
  const bestTime = sessions.length > 0 ? Math.min(...sessions.filter((s: any) => s.completionTimeMs > 0).map((s: any) => s.completionTimeMs)) : null;

  // Recent 10 games for history
  const recentSessions = sessions.slice(0, 10).map((s: any) => ({
    sessionId: s.sessionId,
    score: s.totalScore || 0,
    designation: s.designation,
    completionTimeMs: s.completionTimeMs,
    completedLevels: s.completedLevels,
    completedAt: s.endTime,
  }));

  // Stimuli stats
  const sessionIds = sessions.map((s: any) => s.sessionId);
  const attempts = sessionIds.length > 0
    ? await StimulusAttempt.find({ sessionId: { $in: sessionIds } }).lean()
    : [];
  const stimuliCorrect = attempts.filter((a: any) => a.isCorrect).length;
  const stimuliTotal = attempts.length;

  // Try to get email from linked User account
  let email = player.email || null;
  if (!email && player.user) {
    try {
      const { User } = require('../models/User');
      const userDoc = await User.findById(player.user).lean();
      if (userDoc?.email) email = userDoc.email;
    } catch { /* optional */ }
  }

  return {
    player: {
      playerId: player.playerId,
      name: player.name,
      email,
      createdAt: player.createdAt,
    },
    stats: {
      totalGames,
      bestScore,
      avgScore,
      bestTime,
      stimuliCorrect,
      stimuliTotal,
    },
    recentSessions,
  };
}
