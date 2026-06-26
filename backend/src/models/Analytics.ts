import { Schema, model } from 'mongoose';
import { IAnalytics } from '../types';

const analyticsSchema = new Schema<IAnalytics>(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    session: { type: Schema.Types.ObjectId, ref: 'GameSession', required: true },
    player: { type: Schema.Types.ObjectId, ref: 'Player', required: true, index: true },
    playerId: { type: String, required: true, index: true },
    strongestCategory: { type: String },
    weakestCategory: { type: String },
    categoryAccuracy: { type: Schema.Types.Mixed }, // { [category]: 0..100 }
    tierAccuracy: { type: Schema.Types.Mixed }, // { [tier]: 0..100 }
    phishingDetectionRate: { type: Number }, // % of threats caught
    falseAlarmRate: { type: Number }, // % of safe elements wrongly flagged
    compositeScore: { type: Number },
    // Report snapshot consumed by the downloadable share card
    designation: { type: String },
    readinessLevel: { type: String, enum: ['LOW', 'MODERATE', 'HIGH', 'ELITE'] },
    reportSummary: { type: String },
    strengths: { type: [String] },
    weaknesses: { type: [String] },
    readinessSummary: { type: String },
    threatsCaughtPct: { type: Number },
    stimulusAccuracy: { type: Number },
    stimuliCorrect: { type: Number },
    stimuliTotal: { type: Number },
  },
  { timestamps: true }
);

export const Analytics = model<IAnalytics>('Analytics', analyticsSchema);
