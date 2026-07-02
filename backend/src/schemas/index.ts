import { z } from 'zod';

const readinessEnum = z.enum(['LOW', 'MODERATE', 'HIGH', 'ELITE']);
const statusEnum = z.enum(['active', 'completed', 'abandoned']);

/** Players */
export const upsertPlayerSchema = z.object({
  playerId: z.string().min(8).max(64),
  name: z.string().trim().max(40).optional().transform((v) => v || 'ANONYMOUS'),
  email: z.string().trim().toLowerCase().email().optional(),
  userId: z.string().optional(), // links the player to an authed User
});
export const updatePlayerSchema = z.object({
  name: z.string().trim().min(1).max(40).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
});

/** Sessions */
export const startSessionSchema = z.object({
  sessionId: z.string().min(8).max(64),
  playerId: z.string().min(8).max(64),
});

export const attemptSchema = z.object({
  stimulusId: z.string().min(1),
  category: z.string().min(1),
  tier: z.number().int().min(1).max(5),
  roundNumber: z.number().int().min(1).max(5).optional(),
  playerChoice: z.string().optional(),
  correctAnswer: z.unknown().optional(),
  investigations: z.unknown().optional(),
  isCorrect: z.boolean().default(false),
  scoreAwarded: z.number().min(0).default(0),
  responseTimeMs: z.number().int().min(0).optional(),
});

export const progressSchema = z.object({
  totalScore: z.number().min(0).optional(),
  completedLevels: z.number().int().min(0).max(5).optional(),
  livesRemaining: z.number().int().min(0).optional(),
  streakAchieved: z.number().int().min(0).optional(),
  stimuliAttempted: z.number().int().min(0).optional(),
  completionTimeMs: z.number().int().min(0).optional(),
});

export const finishSessionSchema = progressSchema.extend({
  totalScore: z.number().min(0),
  designation: z.string().optional(),
  readinessLevel: readinessEnum.optional(),
  completedLevels: z.number().int().min(0).max(5),
  livesRemaining: z.number().int().min(0).optional(),
  streakAchieved: z.number().int().min(0),
  completionTimeMs: z.number().int().min(0).optional(),
  reportSummary: z.string().optional(),
});

/** Report / analytics */
export const reportSchema = z.object({
  compositeScore: z.number().min(0),
  designation: z.string().optional(),
  readinessLevel: readinessEnum.optional(),
  strongestCategory: z.string().optional(),
  weakestCategory: z.string().optional(),
  categoryAccuracy: z.record(z.string(), z.number()).optional(),
  tierAccuracy: z.record(z.string(), z.number()).optional(),
  phishingDetectionRate: z.number().min(0).max(100).optional(),
  falseAlarmRate: z.number().min(0).max(100).optional(),
  reportSummary: z.string().optional(),
  // snapshot of breakdown used by the downloadable share card
  threatsCaughtPct: z.number().optional(),
  stimulusAccuracy: z.number().optional(),
  stimuliCorrect: z.number().optional(),
  stimuliTotal: z.number().optional(),
  strengths: z.array(z.string()).optional(),
  weaknesses: z.array(z.string()).optional(),
  readinessSummary: z.string().optional(),
});

/** Email report — payload for POST /api/sessions/:sessionId/email-report. */
export const emailReportSchema = z.object({
  playerName: z.string().max(40).optional(),
  compositeScore: z.number().min(0).optional(),
  designation: z.string().optional(),
  reportSummary: z.string().optional(),
  strengths: z.array(z.string()).optional(),
  weaknesses: z.array(z.string()).optional(),
  readinessLevel: z.string().optional(),
  threatsCaughtPct: z.number().min(0).max(100).optional(),
  pngBase64: z.string().min(100, 'Report image is required'),
});
