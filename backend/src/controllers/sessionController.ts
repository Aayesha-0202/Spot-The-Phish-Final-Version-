import { Request, Response, NextFunction } from 'express';
import * as sessionService from '../services/sessionService';
import { asyncHandler } from '../utils/asyncHandler';
import { sendCreated, sendSuccess } from '../utils/response';

/** POST /api/sessions/start — start a game session. */
export const startSession = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const { sessionId, playerId } = req.body;
  const session = await sessionService.startSession(sessionId, playerId);
  const wasCreated = session.createdAt?.getTime() === session.updatedAt?.getTime();
  return (wasCreated ? sendCreated : sendSuccess)(res, session, wasCreated ? 'Session started' : 'Session already exists');
});

/** POST /api/sessions/:sessionId/attempts — record a completed stimulus. */
export const recordAttempt = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const attempt = await sessionService.recordAttempt(req.params.sessionId, req.body);
  return sendCreated(res, attempt, 'Attempt recorded');
});

/** PATCH /api/sessions/:sessionId/progress — save mid-game progress. */
export const saveProgress = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const session = await sessionService.saveProgress(req.params.sessionId, req.body);
  return sendSuccess(res, session, 'Progress saved');
});

/** POST /api/sessions/:sessionId/finish — finish the game. */
export const finishSession = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const session = await sessionService.finishSession(req.params.sessionId, req.body);
  return sendSuccess(res, session, 'Game finished');
});

/** GET /api/sessions/:sessionId */
export const getSession = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const session = await sessionService.getSession(req.params.sessionId);
  return sendSuccess(res, session, 'Session found');
});

/** GET /api/sessions?playerId=...&limit=... — previous sessions for a player. */
export const listSessions = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const playerId = req.query.playerId as string;
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const sessions = await sessionService.listSessions(playerId, limit);
  return sendSuccess(res, sessions, 'Sessions fetched');
});
