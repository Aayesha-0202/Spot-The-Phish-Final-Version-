import { Router } from 'express';
import * as ctrl from '../controllers/analyticsController';

const router = Router();

router.get('/overall', ctrl.overall);
router.get('/categories', ctrl.categories);
router.get('/tiers', ctrl.tiers);
router.get('/leaderboard', ctrl.leaderboard);

export default router;
