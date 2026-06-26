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
  submitInvestigation: () => { scoreChange: number, healthChange: number };
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
  health: 100, // 0 to 100
  lives: 3,
  streak: 0,
  currentRound: 0,
  currentStimulusIndex: 0,
  usedStimuliIds: [] as string[],
  history: [],
  currentStimuliQueue: [],
  tutorialQueue: TUTORIAL_STIMULI.slice(0, 1),
  currentInvestigations: {} as Partial<Record<ElementId, InvestigationData>>,
  playerId: null as string | null,
  sessionId: null as string | null,
  caseStartTime: Date.now(),
};

/** Fire-and-forget: log backend errors without ever breaking the UI. */
function fire(p: Promise<unknown>) {
  p.catch((e: Error) => console.warn('[gameApi]', e.message));
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
      livesRemaining: state.lives,
      streakAchieved: state.streak,
      stimuliAttempted: state.history.length,
    })
  );
}

/**
 * On game end: finish the session + store the report, then (if authenticated and
 * the run was fully completed) submit to the leaderboard. Each step is awaited
 * internally but the whole thing is fire-and-forget at the call site so it never
 * blocks the results screen.
 */
async function finalize(state: GameStore) {
  if (!state.sessionId) return;
  const a = analyzePerformance(state.history, state.health);
  const fullyCompleted = state.currentRound >= 5 && state.lives > 0;

  try {
    await gameApi.finishSession(state.sessionId, {
      totalScore: state.score,
      designation: a.designation.label,
      readinessLevel: a.readinessLevel,
      completedLevels: Math.min(5, state.currentRound),
      livesRemaining: state.lives,
      streakAchieved: state.streak,
      reportSummary: a.summary,
    });
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

    // Anti-cheat leaderboard submit — only authed, fully-completed runs.
    const auth = useAuthStore.getState();
    if (auth.isAuthenticated && fullyCompleted) {
      await gameApi.submitLeaderboard(state.sessionId, a.compositeScore);
    }
  } catch (e) {
    console.warn('[finalize]', (e as Error).message);
  }

  // Reflect ranking eligibility for the UI (best-effort).
  useGameStore.setState({ lastFullyCompleted: fullyCompleted, rankedSessionId: fullyCompleted ? state.sessionId : null });
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
    const newQueue = getStimuliForTier(1, []);
    const playerId = get().playerId || getOrCreatePlayerId();
    const sessionId = newId('s');
    const { playerName, playerEmail } = get();
    const auth = useAuthStore.getState();
    const userId = auth.user?._id;

    set({
      ...INITIAL_STATE,
      playerName,
      playerEmail,
      playerId,
      sessionId,
      caseStartTime: Date.now(),
      phase: 'INTER_ROUND',
      currentRound: 1,
      currentStimuliQueue: newQueue,
      usedStimuliIds: newQueue.map((s) => s.id),
    });

    // Persist player (with email + auth link) + start session (best-effort).
    fire(gameApi.upsertPlayer(playerId, playerName || 'ANONYMOUS', playerEmail || undefined, userId));
    fire(gameApi.startSession(sessionId, playerId));
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

    // Practice rounds never affect score, streak, health or history.
    if (isTutorial) {
      set({ phase: 'INVESTIGATION_REVIEW' });
      return { scoreChange: 0, healthChange: 0 };
    }

    // Transparent scoring: +10 per correctly classified stimulus (no multipliers).
    const { rawScore, isCorrect, healthChange } = evaluateStimulus(stimulus, state.currentInvestigations);
    const newStreak = isCorrect ? state.streak + 1 : 0;

    const newHistoryEntry: GameHistoryEntry = {
      stimulusId: stimulus.id,
      investigations: state.currentInvestigations,
      scoreChange: rawScore,
      streakMultiplier: 1, // streak is display-only; it does not inflate the score
      isCorrect,
      healthChange,
    };

    const newHistory = [...state.history, newHistoryEntry];
    const newScore = computeTotalScore(newHistory); // exact tally of +10 awards
    const newHealth = Math.max(0, state.health + healthChange);
    let newLives = state.lives;
    if (healthChange < 0) {
      newLives = Math.max(0, state.lives - 1);
    }

    const responseTimeMs = Date.now() - state.caseStartTime;

    set({
      score: newScore,
      health: newHealth,
      lives: newLives,
      streak: newStreak,
      history: newHistory,
      phase: 'INVESTIGATION_REVIEW',
    });

    // Persist this stimulus + running progress (best-effort, non-blocking).
    persistAttempt({ ...get(), currentInvestigations: state.currentInvestigations }, stimulus, isCorrect, rawScore, responseTimeMs);
    persistProgress(get());

    return { scoreChange: rawScore, healthChange };
  },

  proceedToNextCard: () => {
    const state = get();
    const activeQueue = state.currentRound === 0 ? state.tutorialQueue : state.currentStimuliQueue;

    if (state.lives <= 0 && state.currentRound > 0) {
      set({ phase: 'RESULTS' });
      void finalize(get());
      return;
    }

    if (state.currentStimulusIndex + 1 < activeQueue.length) {
      set({
        currentStimulusIndex: state.currentStimulusIndex + 1,
        currentInvestigations: {},
        phase: state.currentRound === 0 ? 'TUTORIAL' : 'PLAYING',
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
    const { sessionId, playerEmail, reportEmailStatus, history, health } = get();
    if (!sessionId || reportEmailStatus !== 'idle') return;
    if (!playerEmail.trim()) {
      set({ reportEmailStatus: 'skipped', reportEmailMessage: 'No email provided — use Download instead.' });
      return;
    }
    const a = analyzePerformance(history, health);
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
