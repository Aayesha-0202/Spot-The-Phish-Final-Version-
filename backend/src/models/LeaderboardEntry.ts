import { Schema, model } from 'mongoose';
import { ILeaderboardEntry } from '../types';

/**
 * One ranked play. Score is ALWAYS the server-recomputed value (anti-cheat).
 * Replays create new entries (one per sessionId); public queries aggregate per
 * user to their highest compositeScore.
 */
const leaderboardEntrySchema = new Schema<ILeaderboardEntry>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', index: true, sparse: true },
    playerId: { type: String, required: true, index: true },
    playerName: { type: String, required: true, default: 'ANONYMOUS' },
    sessionId: { type: String, required: true, unique: true, index: true }, // idempotent submit
    compositeScore: { type: Number, required: true, index: true },
    designation: { type: String },
    readinessLevel: { type: String, enum: ['LOW', 'MODERATE', 'HIGH', 'ELITE'] },
    highestStreak: { type: Number, default: 0 },
    stimuliCorrect: { type: Number, default: 0 },
    stimuliIncorrect: { type: Number, default: 0 },
    avgResponseTimeMs: { type: Number },
    completionTimeMs: { type: Number, index: true }, // total game duration; lower = faster (tiebreaker)
    completedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

export const LeaderboardEntry = model<ILeaderboardEntry>('LeaderboardEntry', leaderboardEntrySchema);
