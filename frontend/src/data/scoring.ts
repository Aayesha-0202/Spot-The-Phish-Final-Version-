import { Stimulus, ElementId, InvestigationData, GameHistoryEntry, ElementData } from '../types';

// ============================================================================
// SCORING CONFIGURATION — tweak these values to adjust scoring behaviour.
// ============================================================================

export const SCORING_CONFIG = {
  /** Points awarded for correctly evaluating a single stimulus. */
  baseStimulusPoints: 10,

  /**
   * Time-based bonus tiers. Evaluated top-down: the first matching threshold
   * wins. If no tier matches, bonus is 0.
   */
  timeBonuses: [
    { maxSeconds: 5, bonus: 2 },
  ],

  /**
   * Anti-cheat: responses faster than this are not credible and earn 0 points.
   * Applies to both correct and incorrect answers.
   */
  minResponseTimeMs: 1000,

  /**
   * Wrong-answer penalty tiers. Applied when the stimulus evaluation is
   * incorrect (rawScore < 8). Evaluated top-down: first matching tier wins.
   *
   * Example: 1 wrong accusation → -5, 2+ wrong → -8.
   */
  wrongAnswerPenalties: [
    { maxWrong: 1, penalty: -5 },
    { maxWrong: Infinity, penalty: -8 },
  ],

  /**
   * Accuracy bonus tiers for end-of-game. Evaluated top-down: first matching
   * tier wins. accuracyPct = (correct stimuli / total stimuli) × 100.
   */
  accuracyBonuses: [
    { minPct: 100, bonus: 25 },
    { minPct: 90, bonus: 15 },
    { minPct: 80, bonus: 10 },
    { minPct: 70, bonus: 5 },
  ],

  /**
   * Completion bonus: awarded ONLY when the game finishes within the time
   * limit AND accuracy is at least minAccuracyPct.
   */
  completionBonus: {
    maxTimeSeconds: 300,
    minAccuracyPct: 80,
    bonus: 10,
  },

  /**
   * Longest streak bonus: awards points based on the longest consecutive
   * correct streak achieved during the game.
   */
  longestStreakBonuses: [
    { minStreak: 12, bonus: 15 },
    { minStreak: 8, bonus: 10 },
    { minStreak: 5, bonus: 5 },
  ],
} as const;

// ============================================================================
// DERIVED CONSTANTS (do not modify — computed from config above)
// ============================================================================

export const CORRECT_STIMULUS_POINTS = SCORING_CONFIG.baseStimulusPoints;

/** Theoretical max base score: 15 stimuli × baseStimulusPoints. */
export const MAX_BASE_SCORE = 15 * SCORING_CONFIG.baseStimulusPoints;

/** Absolute max possible score including all bonuses. */
export const MAX_SCORE =
  MAX_BASE_SCORE +
  SCORING_CONFIG.timeBonuses[0].bonus * 15 +         // every stimulus hits top time tier
  SCORING_CONFIG.accuracyBonuses[0].bonus +           // 100% accuracy
  SCORING_CONFIG.completionBonus.bonus +              // fast completion
  SCORING_CONFIG.longestStreakBonuses[0].bonus;       // longest streak 12+

// ============================================================================
// TYPES
// ============================================================================

const ELEMENT_IDS: ElementId[] = ['sender', 'content', 'actionUrl', 'actionText', 'amount'];

export interface StimulusScoreResult {
  rawScore: number;   // base score for this stimulus (can be negative)
  isCorrect: boolean; // true if score >= 8 (80%+)
  hasWrongAccusations: boolean; // true if user wrongly flagged safe elements as suspicious
}

export interface ScoreBreakdown {
  /** Sum of per-stimulus base scores (can be negative). */
  baseScore: number;
  /** Sum of per-stimulus time bonuses. */
  timeBonus: number;
  /** Accuracy bonus for end-of-game performance. */
  accuracyBonus: number;
  /** One-time bonus for finishing the game quickly + accurately. */
  completionBonus: number;
  /** Bonus for longest consecutive correct streak. */
  longestStreakBonus: number;
  /** Active streak multiplier applied to baseScore only. */
  streakMultiplier: number;
  /** Final = baseScore × multiplier + timeBonus + accuracyBonus + completionBonus + longestStreakBonus. */
  finalScore: number;
}

// ============================================================================
// PER-STIMULUS EVALUATION
// ============================================================================

/**
 * Evaluate a single stimulus using the proportional scoring model.
 * Returns the base score — time bonuses and penalties are computed separately.
 */
export function evaluateStimulus(
  stimulus: Stimulus,
  investigations: Partial<Record<ElementId, InvestigationData>>
): StimulusScoreResult {
  const elements = ELEMENT_IDS.map((id) => {
    const el = (stimulus as unknown as Record<string, ElementData | undefined>)[id];
    if (!el) return null;
    return { id, isSuspicious: el.isSuspicious, status: investigations[id]?.status };
  }).filter(Boolean) as { id: ElementId; isSuspicious: boolean; status: string | undefined }[];

  const suspiciousElements = elements.filter((e) => e.isSuspicious);
  const cleanElements = elements.filter((e) => !e.isSuspicious);
  const isSafeImage = suspiciousElements.length === 0;

  if (isSafeImage) {
    const hasAnyInvestigation = Object.keys(investigations).length > 0;
    const wrongAccusations = cleanElements.filter((e) => e.status === 'SUSPICIOUS').length;
    if (!hasAnyInvestigation || wrongAccusations > 0) {
      return { rawScore: 0, isCorrect: false, hasWrongAccusations: wrongAccusations > 0 };
    }
    return { rawScore: CORRECT_STIMULUS_POINTS, isCorrect: true, hasWrongAccusations: false };
  }

  const hasAnyInvestigation = Object.keys(investigations).length > 0;
  if (!hasAnyInvestigation) {
    return { rawScore: 0, isCorrect: false, hasWrongAccusations: false };
  }

  const caught = suspiciousElements.filter((e) => e.status === 'SUSPICIOUS').length;
  const wrongAccusations = cleanElements.filter((e) => e.status === 'SUSPICIOUS').length;
  const total = suspiciousElements.length;

  const netCaught = Math.max(0, caught - wrongAccusations);
  const rawScore = Math.min(CORRECT_STIMULUS_POINTS, Math.round((netCaught / total) * CORRECT_STIMULUS_POINTS));
  const isCorrect = rawScore >= 8;

  return { rawScore, isCorrect, hasWrongAccusations: wrongAccusations > 0 };
}

// ============================================================================
// WRONG-ANSWER PENALTY
// ============================================================================

/**
 * Compute the penalty for an incorrect stimulus response.
 * Returns 0 if the answer was correct. Otherwise returns a negative value
 * based on the number of wrong accusations.
 */
export function computeWrongPenalty(
  stimulus: Stimulus,
  investigations: Partial<Record<ElementId, InvestigationData>>
): number {
  const elements = ELEMENT_IDS.map((id) => {
    const el = (stimulus as unknown as Record<string, ElementData | undefined>)[id];
    if (!el) return null;
    return { isSuspicious: el.isSuspicious, status: investigations[id]?.status };
  }).filter(Boolean) as { isSuspicious: boolean; status: string | undefined }[];

  const cleanElements = elements.filter((e) => !e.isSuspicious);
  const wrongAccusations = cleanElements.filter((e) => e.status === 'SUSPICIOUS').length;

  if (wrongAccusations === 0) return 0;

  for (const tier of SCORING_CONFIG.wrongAnswerPenalties) {
    if (wrongAccusations <= tier.maxWrong) return tier.penalty;
  }
  return 0;
}

// ============================================================================
// TIME BONUS
// ============================================================================

/**
 * Compute the time bonus for a single stimulus.
 * Returns 0 if the response was too fast (anti-cheat) or too slow.
 */
export function computeTimeBonus(responseTimeMs: number): number {
  if (responseTimeMs < SCORING_CONFIG.minResponseTimeMs) return 0;
  const seconds = responseTimeMs / 1000;
  for (const tier of SCORING_CONFIG.timeBonuses) {
    if (seconds <= tier.maxSeconds) return tier.bonus;
  }
  return 0;
}

// ============================================================================
// ACCURACY BONUS
// ============================================================================

/** Count correct stimuli from history (rawScore >= 8). */
function countCorrect(history: GameHistoryEntry[]): number {
  return history.filter((h) => h.isCorrect).length;
}

/** Compute accuracy percentage. */
export function computeAccuracyPct(history: GameHistoryEntry[]): number {
  if (history.length === 0) return 0;
  return (countCorrect(history) / history.length) * 100;
}

/**
 * Compute the accuracy bonus based on the percentage of correctly answered stimuli.
 */
export function computeAccuracyBonus(history: GameHistoryEntry[]): number {
  const pct = computeAccuracyPct(history);
  for (const tier of SCORING_CONFIG.accuracyBonuses) {
    if (pct >= tier.minPct) return tier.bonus;
  }
  return 0;
}

// ============================================================================
// COMPLETION BONUS (now conditional on accuracy)
// ============================================================================

/**
 * Compute the one-time completion bonus. Returns 0 unless the game finished
 * within the time limit AND accuracy meets the minimum threshold.
 */
export function computeCompletionBonus(
  completionTimeMs: number,
  accuracyPct: number
): number {
  const { maxTimeSeconds, minAccuracyPct, bonus } = SCORING_CONFIG.completionBonus;
  if (maxTimeSeconds === Infinity) return 0;
  const withinTime = completionTimeMs <= maxTimeSeconds * 1000;
  const accurateEnough = accuracyPct >= minAccuracyPct;
  return withinTime && accurateEnough ? bonus : 0;
}

// ============================================================================
// LONGEST STREAK BONUS
// ============================================================================

/**
 * Compute the longest consecutive correct streak from history.
 */
export function computeLongestStreak(history: GameHistoryEntry[]): number {
  let longest = 0;
  let current = 0;
  for (const h of history) {
    if (h.isCorrect) {
      current++;
      if (current > longest) longest = current;
    } else {
      current = 0;
    }
  }
  return longest;
}

/**
 * Compute the bonus for the longest streak achieved.
 * Only awarded if the player actually caught some threats (threatsCaughtPct > 0).
 * Prevents inflating scores when the streak consists only of safe image clearances.
 */
export function computeLongestStreakBonus(history: GameHistoryEntry[], threatsCaughtPct: number = 0): number {
  if (threatsCaughtPct <= 0) return 0; // no streak bonus without threat detection
  const longest = computeLongestStreak(history);
  for (const tier of SCORING_CONFIG.longestStreakBonuses) {
    if (longest >= tier.minStreak) return tier.bonus;
  }
  return 0;
}

// ============================================================================
// SCORE BREAKDOWN
// ============================================================================

/**
 * Compute the full score breakdown from game history and completion time.
 *
 * This is the single source of truth for the final score.
 *
 * Formula:
 *   finalScore = baseScore × streakMultiplier
 *              + timeBonus
 *              + accuracyBonus
 *              + completionBonus (only if fast + accurate)
 *              + longestStreakBonus
 */
export function computeScoreBreakdown(
  history: GameHistoryEntry[],
  completionTimeMs: number,
  streakMultiplier: number = 1,
  threatsCaughtPct: number = 0,
  isGameEnd: boolean = false,
): ScoreBreakdown {
  const baseScore = history.reduce((sum, h) => sum + h.scoreChange, 0);

  // Time bonuses are ONLY awarded for correct answers.
  const timeBonus = history.reduce((sum, h) => {
    if (!h.isCorrect) return sum;
    const responseMs = h.responseTimeMs ?? Infinity;
    return sum + (responseMs < Infinity ? computeTimeBonus(responseMs) : 0);
  }, 0);

  // Accuracy, completion, and longest-streak bonuses are ONLY applied at game end.
  // During live gameplay these must be 0 so the score display reflects actual earned points.
  const accuracyPct = computeAccuracyPct(history);
  const accuracyBonus = isGameEnd ? computeAccuracyBonus(history) : 0;
  const completion = isGameEnd ? computeCompletionBonus(completionTimeMs, accuracyPct) : 0;
  const longestStreakBonus = isGameEnd ? computeLongestStreakBonus(history, threatsCaughtPct) : 0;

  const effectiveBase = baseScore * streakMultiplier;

  return {
    baseScore,
    timeBonus,
    accuracyBonus,
    completionBonus: completion,
    longestStreakBonus,
    streakMultiplier,
    finalScore: effectiveBase + timeBonus + accuracyBonus + completion + longestStreakBonus,
  };
}

// ============================================================================
// BACKWARD-COMPATIBLE HELPERS
// ============================================================================

/** Live base score = sum of per-stimulus base awards (no bonuses). */
export function computeTotalScore(history: GameHistoryEntry[]): number {
  return history.reduce((sum, h) => sum + h.scoreChange, 0);
}

/**
 * Compute the live total including bonuses (used for display).
 * During gameplay, completion/accuracy bonuses are always 0 until the game ends.
 */
export function computeLiveTotal(
  history: GameHistoryEntry[],
  completionTimeMs: number = Infinity,
  streakMultiplier: number = 1,
  threatsCaughtPct: number = 0,
): number {
  const breakdown = computeScoreBreakdown(history, completionTimeMs, streakMultiplier, threatsCaughtPct);
  return breakdown.finalScore;
}
