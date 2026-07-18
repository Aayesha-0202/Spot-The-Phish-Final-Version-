/**
 * Streak Reward System
 *
 * Tracks consecutive correct answers and applies configurable multipliers,
 * extra lives, and visual effects at milestone thresholds.
 *
 * The streak manager is a pure state machine — it does not depend on React
 * or any framework. The game store owns the instance and calls its methods.
 */

// ============================================================================
// STREAK CONFIGURATION — tweak these values to adjust streak behaviour.
// ============================================================================

export interface StreakMilestone {
  /** Streak count that unlocks this milestone. */
  streak: number;
  /** Score multiplier applied to base stimulus score. */
  multiplier: number;
  /** How many *subsequent* stimuli this multiplier applies to. Infinity = rest of round. */
  appliesToNext: number;
  /** Human-readable message shown in the notification. */
  message: string;
  /** Named visual effect for the notification component. */
  effect: 'smallFlash' | 'mediumFlash' | 'largeFlash' | 'cinematic';
}

export const STREAK_MILESTONES: StreakMilestone[] = [
  {
    streak: 3,
    multiplier: 1.10,
    appliesToNext: 1,
    message: 'Sharp eye!',
    effect: 'smallFlash',
  },
  {
    streak: 5,
    multiplier: 1.20,
    appliesToNext: 2,
    message: 'On a roll!',
    effect: 'mediumFlash',
  },
  {
    streak: 8,
    multiplier: 1.35,
    appliesToNext: 3,
    message: 'Sentinel mode!',
    effect: 'largeFlash',
  },
  {
    streak: 12,
    multiplier: 1.50,
    appliesToNext: Infinity,
    message: 'Untouchable!',
    effect: 'cinematic',
  },
];

// ============================================================================
// TYPES
// ============================================================================

export interface StreakState {
  /** Current consecutive correct streak. */
  count: number;
  /** Active multiplier (1 = no boost). */
  multiplier: number;
  /** Number of remaining stimuli this multiplier applies to. 0 = inactive. */
  boostedRemaining: number;
}

export interface StreakReward {
  /** The milestone that was just reached (null if none). */
  milestone: StreakMilestone | null;
  /** The multiplier to apply to this stimulus's base score. */
  multiplier: number;
}

// ============================================================================
// STREAK MANAGER
// ============================================================================

const INITIAL_STREAK_STATE: StreakState = {
  count: 0,
  multiplier: 1,
  boostedRemaining: 0,
};

export class StreakManager {
  private state: StreakState = { ...INITIAL_STREAK_STATE };

  /** Reset to zero (e.g. on round start or game reset). */
  reset(): void {
    this.state = { ...INITIAL_STREAK_STATE };
  }

  /** Get a read-only snapshot of the current state. */
  getState(): Readonly<StreakState> {
    return this.state;
  }

  /**
   * Process a correct answer: increment streak, check milestones, apply
   * multiplier, and return any reward earned.
   *
   * Call this AFTER the stimulus has been evaluated as correct.
   */
  onCorrectAnswer(): StreakReward {
    this.state.count++;

    // Tick down the boosted remaining count from a previous milestone.
    if (this.state.boostedRemaining > 0 && this.state.boostedRemaining !== Infinity) {
      this.state.boostedRemaining--;
    }

    // Check if we've hit a new milestone (highest matching, not yet reached).
    const milestone = this.findMilestone();

    if (milestone) {
      this.state.multiplier = milestone.multiplier;
      this.state.boostedRemaining = milestone.appliesToNext;
    } else if (this.state.boostedRemaining === 0) {
      // Boost expired — revert to 1x.
      this.state.multiplier = 1;
    }

    return {
      milestone,
      multiplier: this.state.multiplier,
    };
  }

  /**
   * Process a wrong answer: reset streak and boost, clear extra life flag.
   */
  onWrongAnswer(): void {
    this.state.count = 0;
    this.state.multiplier = 1;
    this.state.boostedRemaining = 0;
  }

  /**
   * Get the current multiplier to apply to the next stimulus's base score.
   */
  getMultiplier(): number {
    return this.state.multiplier;
  }

  /**
   * Find the highest milestone the current streak qualifies for that we
   * haven't already passed. Returns null if no new milestone is reached.
   */
  private findMilestone(): StreakMilestone | null {
    // Walk from highest to lowest; return the first match where streak >= threshold.
    for (let i = STREAK_MILESTONES.length - 1; i >= 0; i--) {
      const m = STREAK_MILESTONES[i];
      if (this.state.count >= m.streak) return m;
    }
    return null;
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get the visual effect config for a given effect name.
 * Centralises animation durations so they're easy to tweak.
 */
export const EFFECT_DURATIONS: Record<StreakMilestone['effect'], { flashMs: number; toastMs: number }> = {
  smallFlash:  { flashMs: 400,  toastMs: 2000 },
  mediumFlash: { flashMs: 600,  toastMs: 2500 },
  largeFlash:  { flashMs: 800,  toastMs: 3000 },
  cinematic:   { flashMs: 1200, toastMs: 3500 },
};
