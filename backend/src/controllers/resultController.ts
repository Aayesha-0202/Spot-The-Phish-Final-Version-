import { Request, Response, NextFunction } from 'express';
import * as analyticsService from '../services/analyticsService';
import { asyncHandler } from '../utils/asyncHandler';
import { sendCreated, sendSuccess } from '../utils/response';

/** POST /api/sessions/:sessionId/report — save final report + analytics. */
export const saveReport = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const analytics = await analyticsService.saveReport(req.params.sessionId, req.body);
  return sendCreated(res, analytics, 'Report saved');
});

/** GET /api/sessions/:sessionId/report */
export const getReport = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const data = await analyticsService.getReport(req.params.sessionId);
  return sendSuccess(res, data, 'Report fetched');
});

/** GET /api/sessions/:sessionId/report/download — metadata for the share card. */
export const getDownloadMetadata = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const metadata = await analyticsService.getDownloadMetadata(req.params.sessionId);
  return sendSuccess(res, metadata, 'Download metadata generated');
});
