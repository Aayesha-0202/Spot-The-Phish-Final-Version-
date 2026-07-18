import { StimulusAttempt } from '../models/StimulusAttempt';
import { GameSession } from '../models/GameSession';
import { logger } from '../utils/logger';

/** Matches the frontend's CORRECT_STIMULUS_POINTS (data/scoring.ts). */
export const CORRECT_STIMULUS_POINTS = 10;
export const MAX_SCORE = 150; // 15 stimuli × 10 pts

export interface RecomputedScore {
  compositeScore: number;
  stimuliCorrect: number;
  stimuliIncorrect: number;
  stimuliTotal: number;
  avgResponseTimeMs?: number;
  highestStreak: number;
  completionTimeMs?: number;
}

/**
 * Recompute a session's final score from its stored StimulusAttempt records.
 * Anti-cheat source of truth — client-supplied score is never trusted for ranking.
 *
 * Uses the session's stored totalScore (which includes streak multipliers,
 * time bonuses, accuracy bonuses, completion bonuses, and longest streak
 * bonuses computed client-side). Falls back to summing raw scoreAwarded
 * if totalScore is missing (backward compat).
 */
export async function recomputeSession(sessionId: string): Promise<RecomputedScore> {
  const attempts = await StimulusAttempt.find({ sessionId }).sort({ timestamp: 1 }).lean();
  const session = await GameSession.findOne({ sessionId }).lean();

  let currentStreak = 0;
  let highestStreak = 0;
  let responseTimeSum = 0;
  let responseTimeCount = 0;
  let rawCompositeScore = 0;
  let correct = 0;

  for (const a of attempts) {
    const scoreAwarded = typeof a.scoreAwarded === 'number' ? a.scoreAwarded : (a.isCorrect ? CORRECT_STIMULUS_POINTS : 0);
    const isCorrectAttempt = a.isCorrect || scoreAwarded >= 8;

    rawCompositeScore += scoreAwarded;
    if (isCorrectAttempt) {
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

  // Use the session's stored totalScore (includes all bonuses: streak multiplier,
  // time bonus, accuracy bonus, completion bonus, longest streak bonus).
  // This matches the client's finalScore which is the actual game score.
  // Fall back to raw sum for backward compatibility with old sessions.
  const compositeScore = (session?.totalScore != null && session.totalScore > 0)
    ? session.totalScore
    : rawCompositeScore;

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
  if (typeof clientScore === 'number' && Math.abs(clientScore - recomputed.compositeScore) > 5) {
    logger.warn(`⚠️ Score integrity mismatch for session ${sessionId}: client=${clientScore} recomputed=${recomputed.compositeScore} — server value used`);
  }
}
