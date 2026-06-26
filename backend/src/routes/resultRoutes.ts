import { Router } from 'express';
import * as ctrl from '../controllers/resultController';
import * as emailCtrl from '../controllers/emailController';
import { validate } from '../middleware/validate';
import { optionalAuth } from '../middleware/auth';
import { reportSchema, emailReportSchema } from '../schemas';

const router = Router();

router.post('/:sessionId/report', validate(reportSchema), ctrl.saveReport);
router.get('/:sessionId/report', ctrl.getReport);
router.get('/:sessionId/report/download', ctrl.getDownloadMetadata);

// Guests may play and receive a report email; auth is optional here.
router.post('/:sessionId/email-report', optionalAuth, validate(emailReportSchema), emailCtrl.emailReport);

export default router;
