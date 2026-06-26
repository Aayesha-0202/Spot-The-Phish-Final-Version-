import nodemailer, { type Transporter } from 'nodemailer';
import { env } from './env';
import { logger } from '../utils/logger';

let transporter: Transporter | null = null;

/**
 * Lazily-created Nodemailer SMTP singleton built from SMTP_* env vars.
 *
 * If no SMTP host is configured we fall back to a JSON-logging transport so the
 * app still boots (and the report-email / reset-password flows surface a clear
 * "email not configured" result rather than crashing).
 */
export function getMailer(): Transporter {
  if (transporter) return transporter;

  if (env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE, // true for 465, false for 587 (STARTTLS)
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  } else {
    // Dev fallback: messages go to the console instead of a real mailbox.
    transporter = nodemailer.createTransport({
      streamTransport: true,
      newline: 'unix',
      buffer: true,
    });
    logger.warn('⚠️ SMTP_HOST not set — emails will be logged to the console, not delivered.');
  }

  return transporter;
}

/** Resolve the From: address (SMTP_FROM > "Name <EMAIL_FROM_ADDRESS>"). */
export function getFromAddress(): string {
  if (env.SMTP_FROM) return env.SMTP_FROM;
  const name = env.EMAIL_FROM_NAME;
  const addr = env.EMAIL_FROM_ADDRESS || 'noreply@spotthephish.local';
  return `${name} <${addr}>`;
}

/** Verify the transport on boot. Logged, never fatal. */
export async function verifyMailer(): Promise<void> {
  try {
    await getMailer().verify();
    logger.info('✅ SMTP transport verified');
  } catch (err) {
    logger.warn('SMTP verify failed (emails may not deliver):', (err as Error).message);
  }
}
