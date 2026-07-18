import { Schema, model } from 'mongoose';
import { ILeaderboardEntry } from '../types';

/**
 * One entry per player. The latest gameplay score always overwrites the previous.
 *
 * Index design (three layers of protection):
 *   1. Partial unique on { user } for authenticated users (sparse).
 *   2. Partial unique on { playerId } filtered to user: null for guests.
 *   3. Compound unique on { playerId, user } as a safety net — enforces one
 *      entry per player regardless of auth state.
 */
const leaderboardEntrySchema = new Schema<ILeaderboardEntry>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', index: true, sparse: true },
    playerId: { type: String, required: true, index: true },
    sessionId: { type: String, required: true, index: true },
    compositeScore: { type: Number, required: true, index: true },
    designation: { type: String },
    readinessLevel: { type: String, enum: ['LOW', 'MODERATE', 'HIGH', 'ELITE'] },
    highestStreak: { type: Number, default: 0 },
    stimuliCorrect: { type: Number, default: 0 },
    stimuliIncorrect: { type: Number, default: 0 },
    avgResponseTimeMs: { type: Number },
    completionTimeMs: { type: Number, index: true },
    completedAt: { type: Date, default: Date.now, index: true },
    // Tracks how many fully-completed games this player has submitted.
    gamesPlayed: { type: Number, default: 1 },
  },
  { timestamps: true }
);

// Unique entry per authenticated user.
leaderboardEntrySchema.index(
  { user: 1 },
  { unique: true, partialFilterExpression: { user: { $exists: true, $ne: null } } }
);

// Unique entry per guest playerId (where user is explicitly null).
leaderboardEntrySchema.index(
  { playerId: 1 },
  { unique: true, partialFilterExpression: { user: null } }
);

// Safety-net compound index: enforces one entry per (playerId, user) pair.
// Prevents duplicates even if auth state differs between requests.
leaderboardEntrySchema.index(
  { playerId: 1, user: 1 },
  { unique: true }
);

export const LeaderboardEntry = model<ILeaderboardEntry>('LeaderboardEntry', leaderboardEntrySchema);
