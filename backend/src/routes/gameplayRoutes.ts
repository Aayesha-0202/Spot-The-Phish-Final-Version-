import { Router } from 'express';
import * as ctrl from '../controllers/gameplayController';

const router = Router();

// Generate a new gameplay session (returns 15 unseen stimuli IDs)
router.post('/generate', ctrl.generateSession);

// Get a player's stimulus history and analytics
router.get('/history/:playerId', ctrl.getPlayerHistory);

// Admin: get analytics for all players
router.get('/admin/players', ctrl.getAllPlayers);

// Admin: reset a player's stimulus history
router.delete('/history/:playerId', ctrl.resetPlayerHistory);

export default router;
