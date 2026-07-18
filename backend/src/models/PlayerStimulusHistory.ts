import { Schema, model } from 'mongoose';
import { IPlayerStimulusHistory } from '../types';

const lastGameplayStimuliSchema = new Schema(
  {
    tier1: { type: [String], default: [] },
    tier2: { type: [String], default: [] },
    tier3: { type: [String], default: [] },
    tier4: { type: [String], default: [] },
    tier5: { type: [String], default: [] },
  },
  { _id: false }
);

const playerStimulusHistorySchema = new Schema<IPlayerStimulusHistory>(
  {
    playerId: { type: String, required: true, unique: true, index: true, trim: true },
    tier1Seen: { type: [String], default: [] },
    tier2Seen: { type: [String], default: [] },
    tier3Seen: { type: [String], default: [] },
    tier4Seen: { type: [String], default: [] },
    tier5Seen: { type: [String], default: [] },
    gamesPlayed: { type: Number, default: 0 },
    totalStimuliSeen: { type: Number, default: 0 },
    lastPlayedAt: { type: Date },
    lastGameplayStimuli: { type: lastGameplayStimuliSchema, default: () => ({}) },
  },
  { timestamps: true }
);

// Index for efficient admin queries
playerStimulusHistorySchema.index({ gamesPlayed: -1 });
playerStimulusHistorySchema.index({ lastPlayedAt: -1 });

export const PlayerStimulusHistory = model<IPlayerStimulusHistory>(
  'PlayerStimulusHistory',
  playerStimulusHistorySchema
);
