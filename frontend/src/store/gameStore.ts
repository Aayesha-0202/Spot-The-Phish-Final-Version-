import { create } from 'zustand';
import { GamePhase, GameState, GameHistoryEntry, Stimulus, ElementId, InvestigationData, ElementData } from '../types';
import { TUTORIAL_STIMULI, GAME_STIMULI, getStimuliForTier, getStimulusCategory } from '../data/stimuli';
import { evaluateStimulus, computeTotalScore, computeScoreBreakdown, computeWrongPenalty, ScoreBreakdown } from '../data/scoring';
import { StreakManager, StreakReward, EFFECT_DURATIONS } from '../data/streak';
import { analyzePerformance } from '../data/performance';
import { gameApi } from '../api/gameApi';
import { getOrCreatePlayerId, newId, resetPlayerId } from '../api/client';
import { useAuthStore } from './authStore';
import { playWrongAnswerSound } from '../utils/audio';

const streakManager = new StreakManager();

/**
 * Compute threat detection rate from game history.
 * Returns the % of phishing stimuli that were correctly handled (isCorrect on phishing).
 */
function computeThreatsCaughtPct(history: GameHistoryEntry[]): number {
  const ELEMENT_IDS: ElementId[] = ['sender', 'content', 'actionUrl', 'actionText', 'amount'];
  let phishTotal = 0, phishCorrect = 0;
  for (const h of history) {
    const stimulus = GAME_STIMULI.find(s => s.id === h.stimulusId);
    if (!stimulus) continue;
    const hasSuspicious = ELEMENT_IDS.some(id => {
      const el = (stimulus as unknown as Record<string, ElementData | undefined>)[id];
      return el?.isSuspicious;
    });
    if (hasSuspicious) {
      phishTotal++;
      if (h.isCorrect) phishCorrect++;
    }
  }
  return phishTotal > 0 ? Math.round((phishCorrect / phishTotal) * 100) : 0;
}

export type EmailStatus = 'idle' | 'sending' | 'sent' | 'failed' | 'skipped';

interface GameStore extends GameState {
  currentStimuliQueue: Stimulus[];
  tutorialQueue: Stimulus[];

  // Backend linkage (null until a session starts)
  playerId: string | null;
  sessionId: string | null;
  caseStartTime: number; // ms timestamp when the current case was shown

  // Pre-selected stimuli from backend rotation system (null if backend unavailable)
  preSelectedStimuli: Record<number, string[]> | null;
  currentRoundStimuli: Stimulus[];

  // Email / ranking
  playerEmail: string;
  reportEmailStatus: EmailStatus;
  reportEmailMessage: string;
  lastFullyCompleted: boolean;
  rankedSessionId: string | null;
  leaderboardRank: number | null;
  totalPlayers: number;
  isNewBest: boolean;

  // Whether the codename was restored from a saved profile (controls lobby hint)
  codenameRestored: boolean;

  // Investigation State (Current Card)
  currentInvestigations: Partial<Record<ElementId, InvestigationData>>;

  // Timer pause tracking
  pausedTimeAccumulator: number;
  roundPauseStart: number | null;

  // Score breakdown (base + time bonus + completion bonus)
  scoreBreakdown: ScoreBreakdown;

  // Streak state
  streakMultiplier: number;
  streakMilestone: StreakReward['milestone'];

  // Actions
  setPhase: (phase: GamePhase) => void;
  setPlayerName: (name: string) => void;
  setPlayerEmail: (email: string) => void;
  /** Persist the current playerName to the backend (best-effort PATCH). */
  savePlayerName: () => void;
  /** Load saved profile from backend and pre-fill codename if found. */
  loadPlayerProfile: () => Promise<void>;
  startGame: () => void;
  startTutorial: () => void;
  startNextRound: () => void;
  investigateElement: (elementId: ElementId, data: InvestigationData) => void;
  submitInvestigation: () => { scoreChange: number };
  proceedToNextCard: () => void;
  sendReportEmail: (pngBase64: string) => Promise<void>;
  resetGame: () => void;
}

const INITIAL_STATE = {
  phase: 'LOBBY' as GamePhase,
  playerName: '',
  playerEmail: '',
  reportEmailStatus: 'idle' as EmailStatus,
  reportEmailMessage: '',
  lastFullyCompleted: false,
  rankedSessionId: null as string | null,
  leaderboardRank: null as number | null,
  totalPlayers: 0,
  isNewBest: false,
  codenameRestored: false,
  score: 0,
  streak: 0,
  noInvestigationStreak: 0,
  currentRound: 0,
  currentStimulusIndex: 0,
  usedStimuliIds: [] as string[],
  history: [] as GameHistoryEntry[],
  gameStartTime: null as number | null,
  completionTimeMs: null as number | null,
  currentStimuliQueue: [] as Stimulus[],
  tutorialQueue: TUTORIAL_STIMULI.slice(0, 1),
  currentInvestigations: {} as Partial<Record<ElementId, InvestigationData>>,
  pausedTimeAccumulator: 0,
  roundPauseStart: null as number | null,
  playerId: null as string | null,
  sessionId: null as string | null,
  caseStartTime: Date.now(),
  preSelectedStimuli: null as Record<number, string[]> | null,
  currentRoundStimuli: [] as Stimulus[],
  scoreBreakdown: { baseScore: 0, timeBonus: 0, accuracyBonus: 0, completionBonus: 0, longestStreakBonus: 0, streakMultiplier: 1, finalScore: 0 },
  streakMultiplier: 1,
  streakMilestone: null,
};

/** Fire-and-forget: log backend errors without ever breaking the UI. */
function fire(p: Promise<unknown>) {
  p.catch((e: Error) => console.warn('[gameApi] fire-and-forget error:', e.message));
}

/** Persist a single stimulus attempt to the backend. */
function persistAttempt(state: GameStore, stimulus: Stimulus, isCorrect: boolean, scoreAwarded: number, responseTimeMs: number) {
  if (!state.sessionId) return;
  fire(
    gameApi.recordAttempt(state.sessionId, {
      stimulusId: stimulus.id,
      category: getStimulusCategory(stimulus),
      tier: stimulus.difficultyTier,
      roundNumber: state.currentRound || stimulus.difficultyTier,
      playerChoice: isCorrect ? 'correct' : 'incorrect',
      correctAnswer: {
        sender: stimulus.sender?.isSuspicious,
        content: stimulus.content?.isSuspicious,
        actionUrl: stimulus.actionUrl?.isSuspicious,
        actionText: stimulus.actionText?.isSuspicious,
        amount: stimulus.amount?.isSuspicious,
      },
      investigations: state.currentInvestigations,
      isCorrect,
      scoreAwarded,
      responseTimeMs,
    })
  );
}

/** Persist in-progress totals to the backend. */
function persistProgress(state: GameStore) {
  if (!state.sessionId) return;
  fire(
    gameApi.saveProgress(state.sessionId, {
      totalScore: state.scoreBreakdown.finalScore,
      completedLevels: Math.max(0, state.currentRound - 1),
      streakAchieved: state.streak,
      stimuliAttempted: state.history.length,
    })
  );
}

/**
 * On game end: finish the session + store the report, then (if authenticated and
 * the run was fully completed) submit to the leaderboard.
 * Each step is independent — one failure won't block the others.
 */
async function finalize(state: GameStore) {
  if (!state.sessionId) return;
  const completionTimeMs = state.gameStartTime ? Date.now() - state.gameStartTime : undefined;

  // Compute full breakdown including bonuses for the final score.
  const threatsCaughtPct = computeThreatsCaughtPct(state.history);
  const breakdown = computeScoreBreakdown(state.history, completionTimeMs ?? 0, streakManager.getMultiplier(), threatsCaughtPct, true);

  const a = analyzePerformance(state.history, completionTimeMs ?? 0, breakdown.finalScore);

  // Clamp score to 0 minimum for backend (leaderboard doesn't store negative scores).
  const finalScore = Math.max(0, breakdown.finalScore);

  // Only submit to the leaderboard if the session was successfully marked completed.
  let sessionFinished = false;

  // Update store with completion time and final breakdown
  useGameStore.setState({ completionTimeMs: completionTimeMs ?? null, scoreBreakdown: breakdown });

  // Ensure the session exists in the backend (retry upsertPlayer + startSession if needed)
  try {
    const auth = useAuthStore.getState();
    const userId = auth.user?._id;
    await gameApi.upsertPlayer(state.playerId || '', state.playerName || 'ANONYMOUS', state.playerEmail || undefined, userId);
    await gameApi.startSession(state.sessionId, state.playerId || '');
  } catch (e) {
    console.warn('[finalize] ensureSession failed:', (e as Error).message);
  }

  // Step 1: Finish the session (mark completed with final totals)
  try {
    await gameApi.finishSession(state.sessionId, {
      totalScore: finalScore,
      designation: a.designation.label,
      readinessLevel: a.readinessLevel,
      completedLevels: Math.min(5, state.currentRound),
      streakAchieved: state.streak,
      completionTimeMs,
      reportSummary: a.summary,
    });
    sessionFinished = true;
    console.log('[finalize] finishSession SUCCESS');
  } catch (e) {
    console.warn('[finalize] finishSession failed:', (e as Error).message);
  }

  // Step 2: Save the report analytics (independent of step 1)
  try {
    await gameApi.saveReport(state.sessionId, {
      compositeScore: a.compositeScore,
      designation: a.designation.label,
      readinessLevel: a.readinessLevel,
      strongestCategory: a.strongestCategory,
      weakestCategory: a.weakestCategory,
      categoryAccuracy: Object.fromEntries(a.categoryStats.map((c) => [c.category, c.accuracy])),
      tierAccuracy: Object.fromEntries(a.tierStats.map((t) => [String(t.level), t.accuracy])),
      phishingDetectionRate: a.threatsCaughtPct,
      falseAlarmRate: a.falseAccusationRate,
      reportSummary: a.summary,
      strengths: a.strengths,
      weaknesses: a.weaknesses,
      readinessSummary: a.readinessSummary,
      threatsCaughtPct: a.threatsCaughtPct,
      stimulusAccuracy: a.stimulusAccuracy,
      stimuliCorrect: a.stimuliCorrect,
      stimuliTotal: a.stimuliTotal,
    });
  } catch (e) {
    console.warn('[finalize] saveReport failed:', (e as Error).message);
  }

  // Submit to leaderboard whenever the session was successfully completed.
  const fullyCompleted = sessionFinished;

  // Step 3: Submit to leaderboard (independent of steps 1 & 2)
  const auth = useAuthStore.getState();
  console.log('[finalize] auth state:', { isAuthenticated: auth.isAuthenticated, isGuest: auth.isGuest, fullyCompleted, sessionFinished, sessionId: state.sessionId });
  let leaderboardSubmitted = false;
  let submittedRank: number | null = null;
  let submittedTotal = 0;
  let submittedIsNewBest = false;
  if (fullyCompleted) {
    // Retry up to 2 times with delay in case session creation was slow
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await gameApi.submitLeaderboard(state.sessionId, finalScore);
        console.log('[finalize] leaderboard submit SUCCESS:', result);
        leaderboardSubmitted = true;
        // Extract rank info from the response
        const data = (result as any)?.data;
        if (data?.entry?.rank) submittedRank = data.entry.rank;
        if (data?.isNewBest !== undefined) submittedIsNewBest = data.isNewBest;
        break;
      } catch (e) {
        const msg = (e as Error).message;
        console.warn(`[finalize] leaderboard submit attempt ${attempt + 1} FAILED:`, msg);
        // If session not found, wait and retry (session might still be being created)
        if (msg.includes('Session not found') && attempt === 0) {
          // Wait briefly for the session to propagate, then retry.
          // Do NOT call startSession here — that would create a brand-new
          // session with a 0 score and then submit that to the leaderboard.
          await new Promise(r => setTimeout(r, 1500));
        }
      }
    }
    // Fetch total player count for context
    if (leaderboardSubmitted) {
      try {
        const rankData = await (await import('../api/leaderboardApi')).leaderboardApi.myRank();
        if (rankData?.totalPlayers) submittedTotal = rankData.totalPlayers;
      } catch { /* optional */ }
    }
  } else {
    console.log('[finalize] leaderboard submit SKIPPED:', { isAuthenticated: auth.isAuthenticated, isGuest: auth.isGuest, fullyCompleted });
  }

  // Reflect ranking eligibility for the UI — only if submit actually succeeded.
  useGameStore.setState({
    lastFullyCompleted: leaderboardSubmitted,
    rankedSessionId: leaderboardSubmitted ? state.sessionId : null,
    leaderboardRank: leaderboardSubmitted ? submittedRank : null,
    totalPlayers: submittedTotal,
    isNewBest: submittedIsNewBest,
  });
}

export const useGameStore = create<GameStore>((set, get) => ({
  ...INITIAL_STATE,

  setPhase: (phase) => {
    const state = get();
    const now = Date.now();
    if (phase === 'INTER_ROUND') {
      set({ phase, roundPauseStart: now });
    } else if (phase === 'PLAYING' && state.roundPauseStart) {
      const pauseDuration = now - state.roundPauseStart;
      set({ phase, caseStartTime: now, pausedTimeAccumulator: state.pausedTimeAccumulator + pauseDuration, roundPauseStart: null });
    } else {
      set(phase === 'PLAYING' ? { phase, caseStartTime: now, roundPauseStart: null } : { phase });
    }
  },

  setPlayerName: (name) => set({ playerName: name }),
  setPlayerEmail: (email) => set({ playerEmail: email }),

  /**
   * Persist the current codename to the backend immediately (best-effort).
   * Called on codename input blur and on startGame.
   */
  savePlayerName: () => {
    const { playerId, playerName } = get();
    if (!playerId || !playerName.trim()) return;
    fire(gameApi.updatePlayer(playerId, playerName.trim()));
  },

  /**
   * Load a returning player's saved profile from the backend.
   * - Gets or creates the persistent playerId from localStorage.
   * - If the player exists in the backend, pre-fills their saved codename.
   * - Sets codenameRestored = true so the lobby can show a "welcome back" hint.
   * Safe to call multiple times — only loads once if playerId is already set.
   */
  loadPlayerProfile: async () => {
    const existingPlayerId = get().playerId;
    let playerId = existingPlayerId || getOrCreatePlayerId();
    if (!existingPlayerId) {
      useGameStore.setState({ playerId });
    }
    try {
      // For authenticated users, look up by userId first (handles new browser/device).
      const auth = useAuthStore.getState();
      const userId = auth.user?._id;
      let res: any = null;
      if (userId) {
        try {
          res = await gameApi.getPlayerByUserId(userId);
        } catch {
          // No player linked to this user yet — generate a fresh playerId so we
          // don't accidentally adopt another user's record from localStorage.
          const freshId = resetPlayerId();
          playerId = freshId;
          useGameStore.setState({ playerId: freshId });
        }
      }
      if (!res) {
        res = await gameApi.getPlayer(playerId);
      }
      const savedName = res?.data?.name;
      const savedEmail = res?.data?.email;
      const savedPlayerId = res?.data?.playerId;
      if (savedName && savedName !== 'ANONYMOUS') {
        useGameStore.setState({
          playerName: savedName,
          playerEmail: savedEmail || get().playerEmail,
          playerId: savedPlayerId || playerId,
          codenameRestored: true,
        });
      }
    } catch {
      // Player doesn't exist yet (first visit) — that's fine, leave fields empty.
    }
  },

  startTutorial: () => {
    streakManager.reset();
    set({
      ...INITIAL_STATE,
      playerName: get().playerName,
      playerEmail: get().playerEmail,
      playerId: get().playerId,
      phase: 'TUTORIAL',
      tutorialQueue: TUTORIAL_STIMULI.slice(0, 1),
    });
  },

  startGame: () => {
    streakManager.reset();
    // Fresh run: draw Level 1 and route through the initiation screen.
    const { playerName } = get();
    if (!playerName.trim()) return; // codename is mandatory
    const playerId = get().playerId || getOrCreatePlayerId();
    const sessionId = newId('s');
    const { playerEmail } = get();
    const auth = useAuthStore.getState();
    const userId = auth.user?._id;
    const now = Date.now();

    // Try to fetch pre-selected stimuli from backend rotation system
    const loadFromBackend = async () => {
      try {
        const result = await gameApi.generateGameplay(playerId);
        const data = result as { data: { stimuli: string[]; tierBreakdown: Record<number, string[]>; phishCount: number; safeCount: number } };
        const tierBreakdown = data.data.tierBreakdown;

        // Convert IDs to Stimulus objects for the first round
        const round1Ids = tierBreakdown[1] || [];
        const round1Stimuli = round1Ids
          .map((id: string) => GAME_STIMULI.find((s) => s.id === id))
          .filter(Boolean) as Stimulus[];

        if (round1Stimuli.length === 0) {
          // Fallback to client-side if backend returned empty
          const fallbackQueue = getStimuliForTier(1, []);
          useGameStore.setState({
            preSelectedStimuli: null,
            currentStimuliQueue: fallbackQueue,
            usedStimuliIds: fallbackQueue.map((s) => s.id),
          });
          return;
        }

        useGameStore.setState({
          preSelectedStimuli: tierBreakdown,
          currentStimuliQueue: round1Stimuli,
          usedStimuliIds: round1Ids,
        });
      } catch {
        // Backend unavailable — fall back to client-side selection
        const fallbackQueue = getStimuliForTier(1, []);
        useGameStore.setState({
          preSelectedStimuli: null,
          currentStimuliQueue: fallbackQueue,
          usedStimuliIds: fallbackQueue.map((s) => s.id),
        });
      }
    };

    // Start with client-side selection immediately, then upgrade to backend result
    const initialQueue = getStimuliForTier(1, []);

    set({
      ...INITIAL_STATE,
      playerName,
      playerEmail,
      playerId,
      sessionId,
      caseStartTime: now,
      gameStartTime: now,
      completionTimeMs: null,
      phase: 'INTER_ROUND',
      currentRound: 1,
      currentStimuliQueue: initialQueue,
      usedStimuliIds: initialQueue.map((s) => s.id),
      roundPauseStart: now,
      pausedTimeAccumulator: 0,
    });

    // Fire-and-forget: upsert player + start session + fetch rotation
    fire(
      gameApi.upsertPlayer(playerId, playerName || 'ANONYMOUS', playerEmail || undefined, userId)
        .then(() => gameApi.startSession(sessionId, playerId))
    );

    // Fetch backend rotation (non-blocking)
    loadFromBackend();
  },

  startNextRound: () => {
    const { currentRound, usedStimuliIds, preSelectedStimuli } = get();
    if (currentRound >= 5) {
      set({ phase: 'RESULTS' });
      void finalize(get());
      return;
    }

    const nextRound = currentRound + 1;

    let newQueue: Stimulus[];

    if (preSelectedStimuli && preSelectedStimuli[nextRound]) {
      // Use backend-selected stimuli for this tier
      newQueue = preSelectedStimuli[nextRound]
        .map((id: string) => GAME_STIMULI.find((s) => s.id === id))
        .filter(Boolean) as Stimulus[];
    } else {
      // Fallback to client-side selection
      newQueue = getStimuliForTier(nextRound, usedStimuliIds);
    }

    // If backend returned empty or stimuli not found, fall back to client-side
    if (newQueue.length === 0) {
      newQueue = getStimuliForTier(nextRound, usedStimuliIds);
    }

    // Show the inter-level initiation screen before EVERY level (not just Level 1).
    // gameStartTime is NOT reset — timer continues across rounds.
    set({
      phase: 'INTER_ROUND',
      currentRound: nextRound,
      currentStimuliQueue: newQueue,
      currentStimulusIndex: 0,
      currentInvestigations: {},
      usedStimuliIds: [...usedStimuliIds, ...newQueue.map((s) => s.id)],
      roundPauseStart: Date.now(),
    });
  },

  investigateElement: (elementId, data) => {
    const { currentInvestigations } = get();
    set({
      currentInvestigations: {
        ...currentInvestigations,
        [elementId]: data,
      },
      noInvestigationStreak: 0, // user is actively investigating
    });
  },

  submitInvestigation: () => {
    const state = get();
    const isTutorial = state.phase === 'TUTORIAL';
    const queue = isTutorial ? state.tutorialQueue : state.currentStimuliQueue;
    const stimulus = queue[state.currentStimulusIndex];

    // Practice rounds never affect score, streak, or history.
    if (isTutorial) {
      set({ phase: 'INVESTIGATION_REVIEW' });
      return { scoreChange: 0 };
    }

    const hasInvestigation = Object.keys(state.currentInvestigations).length > 0;

    // No investigation made: clicking Submit/Continue with nothing selected.
    // No score change, no streak impact, no sound — just track the behaviour.
    if (!hasInvestigation) {
      const newNoInvestStreak = state.noInvestigationStreak + 1;
      set({
        phase: 'INVESTIGATION_REVIEW',
        noInvestigationStreak: newNoInvestStreak,
      });
      return { scoreChange: 0 };
    }

    // Reset no-investigation streak since user actually investigated something.
    const responseTimeMs = Date.now() - state.caseStartTime;

    // Anti-cheat: sub-second responses are not credible → 0 points.
    const isTooFast = responseTimeMs < 1000;

    // Subsequent attempt check: if this stimulus is already in history,
    // the first attempt's score stands — subsequent attempts earn 0.
    const previousAttempt = state.history.find((h) => h.stimulusId === stimulus.id);
    const isSubsequentAttempt = !!previousAttempt;
    const attemptNumber = isSubsequentAttempt ? (previousAttempt.attemptNumber + 1) : 1;

    let rawScore = 0;
    let isCorrect = false;

    if (!isTooFast && !isSubsequentAttempt) {
      // First credible attempt: full evaluation.
      const result = evaluateStimulus(stimulus, state.currentInvestigations);
      rawScore = result.rawScore;
      isCorrect = result.isCorrect;

      // Wrong-answer penalty: ONLY applied when user wrongly accused safe elements.
      // Partial catches on scam stimuli earn proportional credit, NOT penalties.
      if (result.hasWrongAccusations) {
        const penalty = computeWrongPenalty(stimulus, state.currentInvestigations);
        rawScore = Math.min(0, rawScore + penalty); // combine partial score with penalty, clamp ≤ 0
      }
    }
    // else: rawScore stays 0, isCorrect stays false

    // Play wrong-answer sound immediately.
    if (!isCorrect) playWrongAnswerSound();

    // Update streak manager and get reward info.
    let streakReward: StreakReward = { milestone: null, multiplier: 1 };
    if (isCorrect) {
      streakReward = streakManager.onCorrectAnswer();
    } else {
      streakManager.onWrongAnswer();
    }
    const newStreak = streakManager.getState().count;
    const multiplier = streakManager.getMultiplier();

    const newHistoryEntry: GameHistoryEntry = {
      stimulusId: stimulus.id,
      investigations: state.currentInvestigations,
      scoreChange: rawScore,
      streakMultiplier: multiplier,
      isCorrect,
      attemptNumber,
      roundNumber: state.currentRound,
      responseTimeMs,
    };

    const newHistory = [...state.history, newHistoryEntry];
    const newThreatsCaughtPct = computeThreatsCaughtPct(newHistory);
    const newBreakdown = computeScoreBreakdown(newHistory, Infinity, multiplier, newThreatsCaughtPct, false);

    set({
      score: newBreakdown.finalScore,
      scoreBreakdown: newBreakdown,
      streak: newStreak,
      noInvestigationStreak: 0, // reset since user investigated
      streakMultiplier: multiplier,
      streakMilestone: streakReward.milestone,
      history: newHistory,
      phase: 'INVESTIGATION_REVIEW',
    });

    // Persist this stimulus + running progress (best-effort, non-blocking).
    persistAttempt({ ...get(), currentInvestigations: state.currentInvestigations }, stimulus, isCorrect, rawScore, responseTimeMs);
    persistProgress(get());

    return { scoreChange: rawScore };
  },

  proceedToNextCard: () => {
    const state = get();
    const activeQueue = state.currentRound === 0 ? state.tutorialQueue : state.currentStimuliQueue;

    // No lives check — game always continues to the end

    if (state.currentStimulusIndex + 1 < activeQueue.length) {
      set({
        currentStimulusIndex: state.currentStimulusIndex + 1,
        currentInvestigations: {},
        phase: state.currentRound === 0 ? 'TUTORIAL' : 'PLAYING',
        caseStartTime: Date.now(), // per-case timer for responseTime tracking
      });
    } else {
      if (state.currentRound === 0) {
        // End of tutorial
        get().startGame();
      } else {
        // End of level → initiation screen for the next level (or results after Level 5).
        get().startNextRound();
      }
    }
  },

  /** Auto-email the finished report. ResultsScreen triggers this after rendering the card. */
  sendReportEmail: async (pngBase64: string) => {
    const { sessionId, playerEmail, reportEmailStatus, history, completionTimeMs, scoreBreakdown } = get();
    if (!sessionId || reportEmailStatus !== 'idle') return;
    if (!playerEmail.trim()) {
      set({ reportEmailStatus: 'skipped', reportEmailMessage: 'No email provided — use Download instead.' });
      return;
    }
    const a = analyzePerformance(history, completionTimeMs ?? 0, scoreBreakdown.finalScore);
    set({ reportEmailStatus: 'sending', reportEmailMessage: '' });
    try {
      await gameApi.emailReport(sessionId, {
        compositeScore: a.compositeScore,
        designation: a.designation.label,
        reportSummary: a.summary,
        strengths: a.strengths,
        weaknesses: a.weaknesses,
        readinessLevel: a.readinessLevel,
        threatsCaughtPct: a.threatsCaughtPct,
        pngBase64,
      });
      const masked = playerEmail.replace(/(^.).+(@.+)/, '$1***$2');
      set({ reportEmailStatus: 'sent', reportEmailMessage: masked });
    } catch (e) {
      set({ reportEmailStatus: 'failed', reportEmailMessage: (e as Error).message });
    }
  },

  resetGame: () => {
    streakManager.reset();
    set({ ...INITIAL_STATE, playerName: get().playerName, playerEmail: get().playerEmail, playerId: get().playerId, preSelectedStimuli: null }); // keep name/email/id for replays
  },
}));
