import { Schema, model } from 'mongoose';
import { IRound } from '../types';

const roundSchema = new Schema<IRound>(
  {
    sessionId: { type: String, required: true, index: true },
    session: { type: Schema.Types.ObjectId, ref: 'GameSession', required: true, index: true },
    player: { type: Schema.Types.ObjectId, ref: 'Player', required: true, index: true },
    playerId: { type: String, required: true, index: true },
    roundNumber: { type: Number, required: true, min: 1, max: 5 },
    tier: { type: Number, required: true, min: 1, max: 5, index: true },
    status: { type: String, enum: ['active', 'completed', 'abandoned'], default: 'active' },
    scoreAwarded: { type: Number, default: 0 },
    correctCount: { type: Number, default: 0 },
    incorrectCount: { type: Number, default: 0 },
    stimuliAttempted: { type: Number, default: 0 },
    avgResponseTimeMs: { type: Number },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date },
  },
  { timestamps: true }
);

// A session has at most one round per round number.
roundSchema.index({ sessionId: 1, roundNumber: 1 }, { unique: true });

export const Round = model<IRound>('Round', roundSchema);
