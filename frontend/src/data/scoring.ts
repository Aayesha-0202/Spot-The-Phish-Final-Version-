import { Stimulus, ElementId, InvestigationData, GameHistoryEntry, ElementData } from '../types';

/**
 * Scoring model — transparent and exact.
 *
 *   - Each correctly classified stimulus awards EXACTLY +10 points (base).
 *   - An incorrect classification awards 0 points.
 *   - The running score is a simple tally of those awards (no normalization,
 *     no hidden offset, no multiplier on the score). The displayed score always
 *     equals the implemented logic.
 *   - "Streak" is tracked separately as a combo counter for UI flair (see the
 *     streak notification + inter-level screen) but does NOT inflate the score.
 *
 * Max possible score = 25 stimuli × 10 = 250.
 */

export const CORRECT_STIMULUS_POINTS = 10; // exact award per correctly classified stimulus
export const MAX_SCORE = 250; // 25 stimuli × 10 points — denominator for the score bar

const ELEMENT_IDS: ElementId[] = ['sender', 'content', 'actionUrl', 'actionText', 'amount'];

export interface StimulusScoreResult {
  rawScore: number; // base score for this stimulus (10 if correct, else 0)
  isCorrect: boolean; // every threat flagged SUSPICIOUS AND no safe element falsely flagged
  healthChange: number;
}

/**
 * Evaluate a single stimulus. Scoring is per-stimulus, not per-element:
 * a fully-correct classification awards exactly CORRECT_STIMULUS_POINTS (+10);
 * anything less awards 0. Health still reflects element-level mistakes
 * (missed threats / false accusations) so lives remain meaningful.
 */
export function evaluateStimulus(
  stimulus: Stimulus,
  investigations: Partial<Record<ElementId, InvestigationData>>
): StimulusScoreResult {
  let healthChange = 0;
  let caughtAllThreats = true;
  let noFalseAccusations = true;

  for (const id of ELEMENT_IDS) {
    const el = (stimulus as unknown) as Record<string, ElementData | undefined>;
    const trueElement = el[id];
    if (!trueElement) continue;

    const status = investigations[id]?.status;

    if (trueElement.isSuspicious) {
      if (status === 'SUSPICIOUS') {
        // threat caught
      } else {
        // missed, or only flagged "not sure" → not a clean classification
        caughtAllThreats = false;
        if (status !== 'NOT_SURE') healthChange -= 8; // ignored a real threat
      }
    } else {
      if (status === 'SUSPICIOUS') {
        healthChange -= 12; // false accusation
        noFalseAccusations = false;
      }
    }
  }

  const isCorrect = caughtAllThreats && noFalseAccusations;
  const rawScore = isCorrect ? CORRECT_STIMULUS_POINTS : 0;
  return { rawScore, isCorrect, healthChange };
}

/** Live/final score = Σ of per-stimulus awards. Pure, no transforms. */
export function computeTotalScore(history: GameHistoryEntry[]): number {
  return history.reduce((sum, h) => sum + h.scoreChange, 0);
}
