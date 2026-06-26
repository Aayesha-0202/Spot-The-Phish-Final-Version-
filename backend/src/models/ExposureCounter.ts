import { Schema, model } from 'mongoose';
import { IExposureCounter } from '../types';

/**
 * Tracks each time a stimulus is shown in a session so the backend can prevent
 * overexposure (the frontend currently mirrors this with usedStimulusIds).
 */
const exposureCounterSchema = new Schema<IExposureCounter>(
  {
    stimulusId: { type: String, required: true, index: true },
    sessionId: { type: String, required: true, index: true },
    shownAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// A stimulus is shown at most once per session.
exposureCounterSchema.index({ stimulusId: 1, sessionId: 1 }, { unique: true });

export const ExposureCounter = model<IExposureCounter>('ExposureCounter', exposureCounterSchema);
