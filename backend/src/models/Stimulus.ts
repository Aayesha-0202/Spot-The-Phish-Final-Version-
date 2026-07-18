import { Schema, model } from 'mongoose';
import { IStimulus } from '../types';

const elementDataSchema = new Schema({
  text: { type: String, default: '' },
  isSuspicious: { type: Boolean, default: false },
  reason: { type: String },
  explanation: { type: String, default: '' },
}, { _id: false });

/**
 * Stimulus content library.
 * Stores full content (sender, body, URL, etc.) so admin can view/edit
 * without relying on the frontend static data file.
 */
const stimulusSchema = new Schema<IStimulus>(
  {
    stimulusId: { type: String, required: true, unique: true, index: true },
    type: { type: String }, // SMS | WHATSAPP | UPI | EMAIL | SOCIAL
    category: { type: String, required: true, index: true },
    tier: { type: Number, required: true, min: 1, max: 5, index: true },
    truthClass: { type: String, enum: ['phish', 'legit'], required: true, index: true },
    // Full content fields
    sender: { type: elementDataSchema },
    content: { type: elementDataSchema },
    actionUrl: { type: elementDataSchema },
    actionText: { type: elementDataSchema },
    amount: { type: elementDataSchema },
    explanation: { type: String, default: '' },
    // Metadata
    cueList: { type: [String], default: [] },
    calibration: { type: Schema.Types.Mixed, default: {} },
    renderedAssets: { type: Schema.Types.Mixed, default: {} },
    language: { type: String, default: 'en' },
    status: { type: String, enum: ['active', 'draft', 'retired'], default: 'active', index: true },
    exposureCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Stimulus = model<IStimulus>('Stimulus', stimulusSchema);
