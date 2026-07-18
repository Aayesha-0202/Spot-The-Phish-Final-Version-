import { GameSession } from '../models/GameSession';
import { StimulusAttempt } from '../models/StimulusAttempt';
import { Player } from '../models/Player';
import { Round } from '../models/Round';
import { ExposureCounter } from '../models/ExposureCounter';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { z } from 'zod';
import { attemptSchema, finishSessionSchema, progressSchema } from '../schemas';

type AttemptInput = z.infer<typeof attemptSchema>;
type ProgressInput = Partial<z.infer<typeof progressSchema>>;
type FinishInput = z.infer<typeof finishSessionSchema>;

async function resolvePlayerId(playerId: string) {
  const player = await Player.findOne({ playerId });
  if (!player) throw ApiError.badRequest('Unknown playerId — create the player first');
  return player;
}

async function requireSession(sessionId: string) {
  const session = await GameSession.findOne({ sessionId });
  if (!session) throw ApiError.notFound('Session not found');
  return session;
}

/** Start a new game session (idempotent on sessionId). */
export async function startSession(sessionId: string, playerId: string) {
  const player = await resolvePlayerId(playerId);
  const existing = await GameSession.findOne({ sessionId });
  if (existing) {
    // Link user if the player has one and the session doesn't (handles
    // guest-played-then-logged-in flow where upsertPlayer set the link after session creation).
    if (player.user && !existing.user) {
      existing.user = player.user as any;
      await existing.save();
    }
    return existing;
  }
  return GameSession.create({
    sessionId,
    player: player._id,
    playerId,
    user: player.user || null,
    email: player.email,
    status: 'active',
    startTime: new Date(),
  });
}

/**
 * Keep the per-round Roll document in sync (best-effort — never blocks the
 * attempt). roundNumber defaults to the stimulus tier (round N draws tier N).
 */
async function tallyRound(
  session: { _id: any; sessionId: string; player: any; playerId: string },
  roundNumber: number,
  tier: number,
  attempt: AttemptInput
): Promise<void> {
  try {
    // If a previous round is still active, close it (a new round has started).
    await Round.updateMany(
      { sessionId: session.sessionId, status: 'active', roundNumber: { $lt: roundNumber } },
      { $set: { status: 'completed', endedAt: new Date() } }
    );

    const rt = typeof attempt.responseTimeMs === 'number' && attempt.responseTimeMs > 0 ? attempt.responseTimeMs : null;
    const inc: Record<string, number> = {
      stimuliAttempted: 1,
      scoreAwarded: attempt.scoreAwarded || 0,
      correctCount: attempt.isCorrect ? 1 : 0,
      incorrectCount: attempt.isCorrect ? 0 : 1,
    };

    const round = await Round.findOneAndUpdate(
      { sessionId: session.sessionId, roundNumber },
      {
        $setOnInsert: {
          session: session._id,
          player: session.player,
          playerId: session.playerId,
          roundNumber,
          tier,
          status: 'active',
          startedAt: new Date(),
        },
        $inc: inc,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Maintain a rolling average response time.
    if (rt !== null && round.stimuliAttempted > 0) {
      const prev = round.avgResponseTimeMs || 0;
      const n = round.stimuliAttempted;
      round.avgResponseTimeMs = Math.round((prev * (n - 1) + rt) / n);
      await round.save().catch(() => undefined);
    }
  } catch (err) {
    logger.warn(`Round tally failed (non-fatal): ${(err as Error).message}`);
  }
}

/** Record a single stimulus attempt (player completes a stimulus). */
export async function recordAttempt(sessionId: string, data: AttemptInput) {
  const session = await requireSession(sessionId);
  const attempt = await StimulusAttempt.create({
    sessionId,
    session: session._id,
    player: session.player,
    playerId: session.playerId,
    stimulusId: data.stimulusId,
    category: data.category,
    tier: data.tier,
    roundNumber: data.roundNumber ?? data.tier,
    playerChoice: data.playerChoice,
    correctAnswer: data.correctAnswer,
    investigations: data.investigations,
    isCorrect: data.isCorrect,
    scoreAwarded: data.scoreAwarded,
    responseTimeMs: data.responseTimeMs,
  });

  // Track exposure (prevent overexposure) + per-round stats — both best-effort.
  ExposureCounter.updateOne(
    { stimulusId: data.stimulusId, sessionId },
    { $set: { shownAt: new Date() } },
    { upsert: true }
  ).catch(() => undefined);

  const roundNumber = data.roundNumber ?? data.tier;
  void tallyRound(session, roundNumber, data.tier, data);

  session.stimuliAttempted = (session.stimuliAttempted || 0) + 1;
  await session.save();
  return attempt;
}

/** Save in-progress state (score/level/lives/streak changes). */
export async function saveProgress(sessionId: string, data: ProgressInput) {
  const session = await requireSession(sessionId);
  Object.assign(session, data);
  await session.save();
  return session;
}

/** Mark a session completed with final totals. */
export async function finishSession(sessionId: string, data: FinishInput) {
  const session = await requireSession(sessionId);
  Object.assign(session, data, { status: 'completed', endTime: new Date() });
  await session.save();

  // Close any still-active rounds.
  await Round.updateMany(
    { sessionId, status: 'active' },
    { $set: { status: 'completed', endedAt: new Date() } }
  ).catch(() => undefined);

  return session;
}

export async function getSession(sessionId: string) {
  return requireSession(sessionId);
}

export async function listSessions(playerId: string, limit = 20) {
  return GameSession.find({ playerId }).sort({ createdAt: -1 }).limit(limit).lean();
}
