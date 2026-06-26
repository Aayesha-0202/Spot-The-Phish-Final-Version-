import { Request, Response, NextFunction } from 'express';
import * as leaderboardService from '../services/leaderboardService';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, sendCreated } from '../utils/response';

/** POST /api/leaderboard/submit — submit a completed session (server-scored). */
export const submit = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const { sessionId, clientScore } = req.body;
  const result = await leaderboardService.submit(sessionId, req.user!._id, clientScore);
  return sendCreated(res, result, 'Score submitted');
});

/** GET /api/leaderboard/top?limit=&period=&offset= */
export const top = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const limit = Math.min(Number(req.query.limit) || 10, 200);
  const period = (req.query.period as 'today' | 'week' | 'month' | 'all') || 'all';
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const currentUserId = req.user?._id;
  const rows = await leaderboardService.top(limit, period, offset, currentUserId);
  return sendSuccess(res, { entries: rows, period, limit, offset }, 'Leaderboard');
});

/** GET /api/leaderboard/recent?limit= */
export const recent = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const limit = Math.min(Number(req.query.limit) || 10, 100);
  const currentUserId = req.user?._id;
  const rows = await leaderboardService.recent(limit, currentUserId);
  return sendSuccess(res, { entries: rows, limit }, 'Recent leaderboard');
});

/** GET /api/leaderboard/rank — the authenticated user's rank. */
export const myRank = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const data = await leaderboardService.rankOfUser(req.user!._id);
  return sendSuccess(res, data, 'Your rank');
});

/** GET /api/leaderboard/best — the authenticated user's best score. */
export const myBest = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const entry = await leaderboardService.bestScoreOfUser(req.user!._id);
  return sendSuccess(res, { entry }, 'Your best score');
});

/** GET /api/leaderboard/by-period?period= */
export const byPeriod = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const period = (req.query.period as 'today' | 'week' | 'month' | 'all') || 'all';
  const currentUserId = req.user?._id;
  const rows = await leaderboardService.top(50, period, 0, currentUserId);
  return sendSuccess(res, { entries: rows, period }, `Leaderboard (${period})`);
});
