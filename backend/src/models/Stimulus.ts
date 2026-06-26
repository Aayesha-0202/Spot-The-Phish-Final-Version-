import { Schema, model } from 'mongoose';
import { IStimulus } from '../types';

/**
 * Stimulus content library (DynamoDB-shaped metadata mirrored in MongoDB).
 * Seeds from backend/src/data/stimuli.ts (npm run seed).
 */
const stimulusSchema = new Schema<IStimulus>(
  {
    stimulusId: { type: String, required: true, unique: true, index: true },
    type: { type: String }, // SMS | WHATSAPP | UPI | EMAIL | SOCIAL
    category: { type: String, required: true, index: true },
    tier: { type: Number, required: true, min: 1, max: 5, index: true },
    truthClass: { type: String, enum: ['phish', 'legit'], required: true, index: true },
    cueList: { type: [String], default: [] }, // human-readable cue descriptors
    calibration: { type: Schema.Types.Mixed, default: {} }, // e.g. per-cue weights / difficulty params
    renderedAssets: { type: Schema.Types.Mixed, default: {} }, // pre-rendered image/text artefact refs
    language: { type: String, default: 'en' },
    status: { type: String, enum: ['active', 'draft', 'retired'], default: 'active', index: true },
    exposureCount: { type: Number, default: 0 }, // total times shown across all sessions
  },
  { timestamps: true }
);

export const Stimulus = model<IStimulus>('Stimulus', stimulusSchema);
