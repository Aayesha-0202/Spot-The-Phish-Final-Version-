import { StimulusAttempt } from '../models/StimulusAttempt';
import { logger } from '../utils/logger';

/** Matches the frontend's CORRECT_STIMULUS_POINTS (data/scoring.ts). */
export const CORRECT_STIMULUS_POINTS = 10;

export interface RecomputedScore {
  compositeScore: number;
  stimuliCorrect: number;
  stimuliIncorrect: number;
  stimuliTotal: number;
  avgResponseTimeMs?: number;
  highestStreak: number;
}

/**
 * Recompute a session's final score from its stored StimulusAttempt records.
 * This is the anti-cheat source of truth: the client-supplied score is never
 * trusted for ranking — only these server-derived values are persisted.
 *
 * Scoring mirrors the frontend exactly:
 *   compositeScore = correctCount * CORRECT_STIMULUS_POINTS
 */
export async function recomputeSession(sessionId: string): Promise<RecomputedScore> {
  const attempts = await StimulusAttempt.find({ sessionId }).sort({ timestamp: 1 }).lean();

  let correct = 0;
  let currentStreak = 0;
  let highestStreak = 0;
  let responseTimeSum = 0;
  let responseTimeCount = 0;

  for (const a of attempts) {
    if (a.isCorrect) {
      correct++;
      currentStreak++;
      highestStreak = Math.max(highestStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
    if (typeof a.responseTimeMs === 'number' && a.responseTimeMs > 0) {
      responseTimeSum += a.responseTimeMs;
      responseTimeCount++;
    }
  }

  const total = attempts.length;
  const compositeScore = correct * CORRECT_STIMULUS_POINTS;

  return {
    compositeScore,
    stimuliCorrect: correct,
    stimuliIncorrect: total - correct,
    stimuliTotal: total,
    avgResponseTimeMs: responseTimeCount > 0 ? Math.round(responseTimeSum / responseTimeCount) : undefined,
    highestStreak,
  };
}

/** Compare a client claim against the recomputed value, logging divergence. */
export function assertScoreIntegrity(sessionId: string, clientScore: number | undefined, recomputed: RecomputedScore): void {
  if (typeof clientScore === 'number' && clientScore !== recomputed.compositeScore) {
    logger.warn(`⚠️ Score integrity mismatch for session ${sessionId}: client=${clientScore} recomputed=${recomputed.compositeScore} — server value used`);
  }
}
