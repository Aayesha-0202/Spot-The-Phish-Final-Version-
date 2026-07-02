import { create } from 'zustand';
import { GamePhase, GameState, GameHistoryEntry, Stimulus, ElementId, InvestigationData } from '../types';
import { TUTORIAL_STIMULI, getStimuliForTier, getStimulusCategory } from '../data/stimuli';
import { evaluateStimulus, computeTotalScore } from '../data/scoring';
import { analyzePerformance } from '../data/performance';
import { gameApi } from '../api/gameApi';
import { getOrCreatePlayerId, newId } from '../api/client';
import { useAuthStore } from './authStore';

export type EmailStatus = 'idle' | 'sending' | 'sent' | 'failed' | 'skipped';

interface GameStore extends GameState {
  currentStimuliQueue: Stimulus[];
  tutorialQueue: Stimulus[];

  // Backend linkage (null until a session starts)
  playerId: string | null;
  sessionId: string | null;
  caseStartTime: number; // ms timestamp when the current case was shown

  // Email / ranking
  playerEmail: string;
  reportEmailStatus: EmailStatus;
  reportEmailMessage: string;
  lastFullyCompleted: boolean;
  rankedSessionId: string | null;

  // Investigation State (Current Card)
  currentInvestigations: Partial<Record<ElementId, InvestigationData>>;

  // Actions
  setPhase: (phase: GamePhase) => void;
  setPlayerName: (name: string) => void;
  setPlayerEmail: (email: string) => void;
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
  score: 0,
  streak: 0,
  currentRound: 0,
  currentStimulusIndex: 0,
  usedStimuliIds: [] as string[],
  history: [] as GameHistoryEntry[],
  gameStartTime: null as number | null,
  completionTimeMs: null as number | null,
  currentStimuliQueue: [] as Stimulus[],
  tutorialQueue: TUTORIAL_STIMULI.slice(0, 1),
  currentInvestigations: {} as Partial<Record<ElementId, InvestigationData>>,
  playerId: null as string | null,
  sessionId: null as string | null,
  caseStartTime: Date.now(),
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
      totalScore: state.score,
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
  const a = analyzePerformance(state.history, completionTimeMs ?? 0);
  const fullyCompleted = state.currentRound >= 5;

  // Update store with completion time
  useGameStore.setState({ completionTimeMs: completionTimeMs ?? null });

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
  let sessionFinished = false;
  try {
    await gameApi.finishSession(state.sessionId, {
      totalScore: state.score,
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

  // Step 3: Submit to leaderboard (independent of steps 1 & 2)
  const auth = useAuthStore.getState();
  console.log('[finalize] auth state:', { isAuthenticated: auth.isAuthenticated, isGuest: auth.isGuest, fullyCompleted, sessionFinished, sessionId: state.sessionId });
  let leaderboardSubmitted = false;
  if (auth.isAuthenticated && fullyCompleted) {
    // Retry up to 2 times with delay in case session creation was slow
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await gameApi.submitLeaderboard(state.sessionId, a.compositeScore);
        console.log('[finalize] leaderboard submit SUCCESS:', result);
        leaderboardSubmitted = true;
        break;
      } catch (e) {
        const msg = (e as Error).message;
        console.warn(`[finalize] leaderboard submit attempt ${attempt + 1} FAILED:`, msg);
        // If session not found, wait and retry (session might still be being created)
        if (msg.includes('Session not found') && attempt === 0) {
          await new Promise(r => setTimeout(r, 1500));
          // Re-ensure session exists before retry
          try {
            await gameApi.startSession(state.sessionId, state.playerId || '');
          } catch { /* ignore */ }
        }
      }
    }
  } else {
    console.log('[finalize] leaderboard submit SKIPPED:', { isAuthenticated: auth.isAuthenticated, isGuest: auth.isGuest, fullyCompleted });
  }

  // Reflect ranking eligibility for the UI — only if submit actually succeeded.
  useGameStore.setState({ lastFullyCompleted: leaderboardSubmitted, rankedSessionId: leaderboardSubmitted ? state.sessionId : null });
}

export const useGameStore = create<GameStore>((set, get) => ({
  ...INITIAL_STATE,

  setPhase: (phase) => set(phase === 'PLAYING' ? { phase, caseStartTime: Date.now() } : { phase }),

  setPlayerName: (name) => set({ playerName: name }),
  setPlayerEmail: (email) => set({ playerEmail: email }),

  startTutorial: () => {
    set({
      ...INITIAL_STATE,
      playerName: get().playerName,
      playerId: get().playerId,
      phase: 'TUTORIAL',
      tutorialQueue: TUTORIAL_STIMULI.slice(0, 1),
    });
  },

  startGame: () => {
    // Fresh run: draw Level 1 and route through the initiation screen.
    const { playerName } = get();
    if (!playerName.trim()) return; // codename is mandatory
    const newQueue = getStimuliForTier(1, []);
    const playerId = get().playerId || getOrCreatePlayerId();
    const sessionId = newId('s');
    const { playerEmail } = get();
    const auth = useAuthStore.getState();
    const userId = auth.user?._id;
    const now = Date.now();

    set({
      ...INITIAL_STATE,
      playerName,
      playerEmail,
      playerId,
      sessionId,
      caseStartTime: now,
      gameStartTime: now, // Global timer starts here and never resets
      completionTimeMs: null,
      phase: 'INTER_ROUND',
      currentRound: 1,
      currentStimuliQueue: newQueue,
      usedStimuliIds: newQueue.map((s) => s.id),
    });

    // Persist player (with email + auth link) THEN start session (must be sequential).
    fire(
      gameApi.upsertPlayer(playerId, playerName || 'ANONYMOUS', playerEmail || undefined, userId)
        .then(() => gameApi.startSession(sessionId, playerId))
    );
  },

  startNextRound: () => {
    const { currentRound, usedStimuliIds } = get();
    if (currentRound >= 5) {
      set({ phase: 'RESULTS' });
      void finalize(get());
      return;
    }

    const nextRound = currentRound + 1;
    // Exclude everything already used so no stimulus repeats within the run.
    const newQueue = getStimuliForTier(nextRound, usedStimuliIds);

    // Show the inter-level initiation screen before EVERY level (not just Level 1).
    // gameStartTime is NOT reset — timer continues across rounds.
    set({
      phase: 'INTER_ROUND',
      currentRound: nextRound,
      currentStimuliQueue: newQueue,
      currentStimulusIndex: 0,
      currentInvestigations: {},
      usedStimuliIds: [...usedStimuliIds, ...newQueue.map((s) => s.id)],
    });
  },

  investigateElement: (elementId, data) => {
    const { currentInvestigations } = get();
    set({
      currentInvestigations: {
        ...currentInvestigations,
        [elementId]: data,
      },
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

    // Proportional scoring: 0-10 pts per stimulus.
    const { rawScore, isCorrect } = evaluateStimulus(stimulus, state.currentInvestigations);
    const newStreak = isCorrect ? state.streak + 1 : 0;
    const responseTimeMs = Date.now() - state.caseStartTime;

    const newHistoryEntry: GameHistoryEntry = {
      stimulusId: stimulus.id,
      investigations: state.currentInvestigations,
      scoreChange: rawScore,
      streakMultiplier: 1, // streak is display-only; it does not inflate the score
      isCorrect,
      roundNumber: state.currentRound,
      responseTimeMs,
    };

    const newHistory = [...state.history, newHistoryEntry];
    const newScore = computeTotalScore(newHistory);

    set({
      score: newScore,
      streak: newStreak,
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
    const { sessionId, playerEmail, reportEmailStatus, history, completionTimeMs } = get();
    if (!sessionId || reportEmailStatus !== 'idle') return;
    if (!playerEmail.trim()) {
      set({ reportEmailStatus: 'skipped', reportEmailMessage: 'No email provided — use Download instead.' });
      return;
    }
    const a = analyzePerformance(history, completionTimeMs ?? 0);
    set({ reportEmailStatus: 'sending', reportEmailMessage: '' });
    try {
      await gameApi.emailReport(sessionId, {
        playerName: get().playerName || 'ANONYMOUS',
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
    set({ ...INITIAL_STATE, playerName: get().playerName, playerEmail: get().playerEmail, playerId: get().playerId }); // keep name/email/id for replays
  },
}));
