import { Request, Response, NextFunction } from 'express';
import * as analyticsService from '../services/analyticsService';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';

/** GET /api/analytics/overall */
export const overall = asyncHandler(async (_req: Request, res: Response, _next: NextFunction) => {
  const data = await analyticsService.overallAnalytics();
  return sendSuccess(res, data, 'Overall analytics');
});

/** GET /api/analytics/categories */
export const categories = asyncHandler(async (_req: Request, res: Response, _next: NextFunction) => {
  const data = await analyticsService.categoryAnalytics();
  return sendSuccess(res, data, 'Category analytics');
});

/** GET /api/analytics/tiers */
export const tiers = asyncHandler(async (_req: Request, res: Response, _next: NextFunction) => {
  const data = await analyticsService.tierAnalytics();
  return sendSuccess(res, data, 'Tier analytics');
});

/** GET /api/analytics/leaderboard?limit= */
export const leaderboard = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const limit = Math.min(Number(req.query.limit) || 10, 100);
  const data = await analyticsService.leaderboard(limit);
  return sendSuccess(res, data, 'Leaderboard');
});
