import { Router } from 'express';
import * as ctrl from '../controllers/playerController';
import { validate } from '../middleware/validate';
import { upsertPlayerSchema, updatePlayerSchema } from '../schemas';

const router = Router();

router.post('/', validate(upsertPlayerSchema), ctrl.createPlayer);
router.get('/:playerId', ctrl.getPlayer);
router.patch('/:playerId', validate(updatePlayerSchema), ctrl.updatePlayer);

export default router;
