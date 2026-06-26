import { Router } from 'express';
import * as ctrl from '../controllers/leaderboardController';
import { validate } from '../middleware/validate';
import { requireAuth, optionalAuth } from '../middleware/auth';
import { submitLeaderboardSchema } from '../schemas/leaderboardSchema';

const router = Router();

// Public-ish reads (optional auth so we can highlight the logged-in user's row).
router.get('/top', optionalAuth, ctrl.top);
router.get('/recent', optionalAuth, ctrl.recent);
router.get('/by-period', optionalAuth, ctrl.byPeriod);

// Authenticated: submit + personal rank/best.
router.post('/submit', requireAuth, validate(submitLeaderboardSchema), ctrl.submit);
router.get('/rank', requireAuth, ctrl.myRank);
router.get('/best', requireAuth, ctrl.myBest);

export default router;
