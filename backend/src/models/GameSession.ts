import { Schema, model } from 'mongoose';
import { ISession } from '../types';

const sessionSchema = new Schema<ISession>(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    player: { type: Schema.Types.ObjectId, ref: 'Player', required: true, index: true },
    playerId: { type: String, required: true, index: true },
    // Auth linkage (null for guests).
    user: { type: Schema.Types.ObjectId, ref: 'User', index: true, sparse: true },
    // Denormalised email so the report-email pipeline can run without a join.
    email: { type: String, trim: true, lowercase: true },
    status: { type: String, enum: ['active', 'completed', 'abandoned'], default: 'active', index: true },
    startTime: { type: Date, default: Date.now },
    endTime: { type: Date },
    totalScore: { type: Number, default: 0, index: true },
    designation: { type: String },
    readinessLevel: { type: String, enum: ['LOW', 'MODERATE', 'HIGH', 'ELITE'] },
    completedLevels: { type: Number, default: 0 },
    livesRemaining: { type: Number, default: 3 },
    streakAchieved: { type: Number, default: 0 },
    stimuliAttempted: { type: Number, default: 0 },
    reportSummary: { type: String },
    rounds: [{ type: Schema.Types.ObjectId, ref: 'Round' }],
  },
  { timestamps: true }
);

export const GameSession = model<ISession>('GameSession', sessionSchema);
