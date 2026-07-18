import { Request, Response, NextFunction } from 'express';
import * as playerService from '../services/playerService';
import { asyncHandler } from '../utils/asyncHandler';
import { sendCreated, sendSuccess } from '../utils/response';

/** POST /api/players — create or update a player (idempotent). */
export const createPlayer = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const { playerId, name, email, userId } = req.body;
  const player = await playerService.upsertPlayer({ playerId, name, email, userId });
  const wasCreated = player.createdAt?.getTime() === player.updatedAt?.getTime();
  return (wasCreated ? sendCreated : sendSuccess)(res, player, wasCreated ? 'Player created' : 'Player updated');
});

/** GET /api/players/:playerId */
export const getPlayer = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const player = await playerService.getPlayer(req.params.playerId);
  return sendSuccess(res, player, 'Player found');
});

/** GET /api/players/by-user/:userId */
export const getPlayerByUserId = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const player = await playerService.getPlayerByUserId(req.params.userId);
  return sendSuccess(res, player, 'Player found');
});

/** PATCH /api/players/:playerId */
export const updatePlayer = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const { name, email } = req.body;
  const player = await playerService.updatePlayer(req.params.playerId, { name, email });
  return sendSuccess(res, player, 'Player updated');
});

/** GET /api/players/:playerId/profile */
export const getPlayerProfile = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const profile = await playerService.getPlayerProfile(req.params.playerId);
  return sendSuccess(res, profile, 'Player profile');
});
