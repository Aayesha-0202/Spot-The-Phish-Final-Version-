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
