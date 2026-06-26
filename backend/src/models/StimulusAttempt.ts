import { Schema, model } from 'mongoose';
import { IAttempt } from '../types';

const attemptSchema = new Schema<IAttempt>(
  {
    sessionId: { type: String, required: true, index: true },
    session: { type: Schema.Types.ObjectId, ref: 'GameSession', required: true, index: true },
    player: { type: Schema.Types.ObjectId, ref: 'Player', required: true, index: true },
    playerId: { type: String, required: true, index: true },
    stimulusId: { type: String, required: true },
    category: { type: String, required: true, index: true },
    tier: { type: Number, required: true, min: 1, max: 5, index: true },
    playerChoice: { type: String },
    correctAnswer: { type: Schema.Types.Mixed },
    investigations: { type: Schema.Types.Mixed },
    isCorrect: { type: Boolean, default: false },
    scoreAwarded: { type: Number, default: 0 },
    responseTimeMs: { type: Number },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const StimulusAttempt = model<IAttempt>('StimulusAttempt', attemptSchema);
