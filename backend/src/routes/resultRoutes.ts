import { Router } from 'express';
import * as ctrl from '../controllers/resultController';
import * as emailCtrl from '../controllers/emailController';
import { validate } from '../middleware/validate';
import { optionalAuth } from '../middleware/auth';
import { reportSchema, emailReportSchema } from '../schemas';
import { getMailer, getFromAddress } from '../config/mailer';
import { logger } from '../utils/logger';

const router = Router();

// SMTP diagnostic — sends a test email to verify transport config.
// MUST be before /:sessionId routes to avoid route conflict.
router.get('/smtp-test', async (req, res) => {
  try {
    const to = (req.query.to as string) || getFromAddress();
    const transporter = getMailer();
    await transporter.verify();
    const info = await transporter.sendMail({
      from: getFromAddress(),
      replyTo: to,
      to,
      subject: 'Spot the Phish — SMTP Test',
      text: `SMTP transport verified at ${new Date().toISOString()}. If you received this, email delivery works.`,
      html: `<div style="background:#0d0d1a;padding:32px;border-radius:8px;max-width:600px;margin:0 auto;color:#e2e8f0">
        <h1 style="font-family:Arial,sans-serif;color:#22d3ee;letter-spacing:2px">SPOT THE PHISH</h1>
        <p style="font-family:monospace;color:#94a3b8">SMTP Transport Test</p>
        <p style="color:#4ade80;font-family:monospace;font-size:14px">✅ Email delivery is working correctly.</p>
        <p style="color:#94a3b8;font-family:monospace;font-size:12px">Verified at: ${new Date().toISOString()}</p>
      </div>`,
    });
    logger.info(`✅ SMTP test email sent to ${to} — messageId: ${info.messageId}`);
    res.json({ ok: true, messageId: info.messageId, sentTo: to, message: `Test email sent to ${to}` });
  } catch (err) {
    logger.error('SMTP test failed:', (err as Error).message);
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.post('/:sessionId/report', validate(reportSchema), ctrl.saveReport);
router.get('/:sessionId/report', ctrl.getReport);
router.get('/:sessionId/report/download', ctrl.getDownloadMetadata);

// Guests may play and receive a report email; auth is optional here.
router.post('/:sessionId/email-report', optionalAuth, validate(emailReportSchema), emailCtrl.emailReport);

export default router;
