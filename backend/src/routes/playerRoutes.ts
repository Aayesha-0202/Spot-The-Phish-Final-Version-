import { Router } from 'express';
import * as ctrl from '../controllers/playerController';
import { validate } from '../middleware/validate';
import { upsertPlayerSchema, updatePlayerSchema } from '../schemas';

const router = Router();

router.post('/', validate(upsertPlayerSchema), ctrl.createPlayer);
router.get('/by-user/:userId', ctrl.getPlayerByUserId);
router.get('/:playerId/profile', ctrl.getPlayerProfile);
router.get('/:playerId', ctrl.getPlayer);
router.patch('/:playerId', validate(updatePlayerSchema), ctrl.updatePlayer);

export default router;
