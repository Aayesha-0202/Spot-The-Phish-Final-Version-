import { Stimulus, ElementId, InvestigationData, GameHistoryEntry, ElementData } from '../types';

/**
 * Proportional Scoring Model
 *
 * THREAT images (at least one suspicious element):
 *   - Score = round(10 × correctlySuspicious / totalSuspiciousElements)
 *   - Each wrong accusation on a clean element subtracts proportionally
 *   - Formula: score = clamp(round(10 × (caught - wrongAccusations) / totalSuspicious), 0, 10)
 *   - isCorrect: score >= 8 (≥80%)
 *
 * SAFE images (ALL elements legitimate):
 *   - Full 10 pts if no element is flagged SUSPICIOUS
 *   - 0 pts if any clean element is wrongly flagged SUSPICIOUS
 *   - Player does NOT need to tag every element as Clean — ignoring them is fine
 *   - isCorrect: no false accusations
 *
 * Max possible score = 15 stimuli × 10 = 150 pts
 */

export const CORRECT_STIMULUS_POINTS = 10;
export const MAX_SCORE = 150; // 15 stimuli × 10 points

const ELEMENT_IDS: ElementId[] = ['sender', 'content', 'actionUrl', 'actionText', 'amount'];

export interface StimulusScoreResult {
  rawScore: number;   // 0-10 per stimulus
  isCorrect: boolean; // true if score >= 8 (80%+)
}

/**
 * Evaluate a single stimulus using the proportional scoring model.
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
    // Safe image: penalise any false accusation on a clean element
    const wrongAccusations = cleanElements.filter((e) => e.status === 'SUSPICIOUS').length;
    const rawScore = wrongAccusations === 0 ? CORRECT_STIMULUS_POINTS : 0;
    return { rawScore, isCorrect: wrongAccusations === 0 };
  }

  // Threat image: proportional score
  const caught = suspiciousElements.filter((e) => e.status === 'SUSPICIOUS').length;
  const wrongAccusations = cleanElements.filter((e) => e.status === 'SUSPICIOUS').length;
  const total = suspiciousElements.length;

  // Net score with wrong-accusation penalty
  const netCaught = Math.max(0, caught - wrongAccusations);
  const rawScore = Math.min(CORRECT_STIMULUS_POINTS, Math.round((netCaught / total) * CORRECT_STIMULUS_POINTS));
  const isCorrect = rawScore >= 8; // ≥80%

  return { rawScore, isCorrect };
}

/** Live/final score = Σ of per-stimulus awards. */
export function computeTotalScore(history: GameHistoryEntry[]): number {
  return history.reduce((sum, h) => sum + h.scoreChange, 0);
}
