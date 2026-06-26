import { Router } from 'express';
import * as ctrl from '../controllers/sessionController';
import { validate } from '../middleware/validate';
import { startSessionSchema, attemptSchema, progressSchema, finishSessionSchema } from '../schemas';

const router = Router();

router.post('/start', validate(startSessionSchema), ctrl.startSession);
router.get('/', ctrl.listSessions);
router.get('/:sessionId', ctrl.getSession);
router.post('/:sessionId/attempts', validate(attemptSchema), ctrl.recordAttempt);
router.patch('/:sessionId/progress', validate(progressSchema), ctrl.saveProgress);
router.post('/:sessionId/finish', validate(finishSessionSchema), ctrl.finishSession);

export default router;
