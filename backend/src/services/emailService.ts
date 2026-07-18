import PDFDocument from 'pdfkit';
import { GameSession } from '../models/GameSession';
import { Player } from '../models/Player';
import { ApiError } from '../utils/ApiError';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { getMailer, getFromAddress } from '../config/mailer';

export interface ReportFields {
  compositeScore?: number;
  designation?: string;
  reportSummary?: string;
  strengths?: string[];
  weaknesses?: string[];
  readinessLevel?: string;
  threatsCaughtPct?: number;
}

export interface SendReportResult {
  messageId: string;
  previewUrl?: string;
  to: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildHtml(name: string, f: ReportFields): string {
  const list = (items: string[] | undefined) =>
    items && items.length
      ? `<ul style="margin:6px 0;padding-left:20px;font-size:14px;color:#374151">${items
          .map((i) => `<li style="margin:4px 0">${escapeHtml(i)}</li>`)
          .join('')}</ul>`
      : `<p style="font-size:14px;color:#9ca3af">—</p>`;

  return `
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,Helvetica,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:24px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden">
        <!-- Header -->
        <tr><td style="background-color:#0891b2;padding:24px 32px">
          <h1 style="margin:0;color:#ffffff;font-size:22px;letter-spacing:1px">SPOT THE PHISH</h1>
          <p style="margin:4px 0 0;color:#cffafe;font-size:13px">Your Neural Assessment Report</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px">
          <p style="margin:0 0 4px;color:#6b7280;font-size:13px">Agent</p>
          <h2 style="margin:0 0 20px;color:#111827;font-size:20px">${escapeHtml(name)}</h2>

          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;border:1px solid #e5e7eb;border-radius:6px">
            <tr><td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:14px">Final Score</td>
                <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#0891b2;font-size:18px;font-weight:bold;text-align:right">${f.compositeScore ?? '—'} PTS</td></tr>
            <tr><td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:14px">Designation</td>
                <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#db2777;font-size:14px;font-weight:bold;text-align:right">${escapeHtml(f.designation || '—')}</td></tr>
            <tr><td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:14px">Readiness</td>
                <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:14px;text-align:right">${escapeHtml(f.readinessLevel || '—')}</td></tr>
            <tr><td style="padding:12px 16px;color:#6b7280;font-size:14px">Threats Caught</td>
                <td style="padding:12px 16px;color:#111827;font-size:14px;text-align:right">${f.threatsCaughtPct ?? '—'}%</td></tr>
          </table>

          ${f.reportSummary ? `<p style="margin:0 0 20px;font-size:14px;color:#374151;background:#f0fdfa;padding:12px;border-left:3px solid #0891b2">${escapeHtml(f.reportSummary)}</p>` : ''}

          <h3 style="margin:0 0 8px;color:#059669;font-size:15px">Key Strengths</h3>${list(f.strengths)}

          <h3 style="margin:16px 0 8px;color:#d97706;font-size:15px">Areas for Improvement</h3>${list(f.weaknesses)}

          <p style="margin:24px 0 0;color:#6b7280;font-size:12px;text-align:center">Your detailed report card is attached as an image and PDF.</p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background-color:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb">
          <p style="margin:0;color:#9ca3af;font-size:11px;text-align:center">
            This is a one-time report from Spot the Phish — a cybersecurity training tool.<br>
            You received this because you linked your email during the assessment.<br>
            <a href="mailto:spotthephish@gmail.com?subject=unsubscribe" style="color:#0891b2">Unsubscribe</a> · 
            <a href="mailto:spotthephish@gmail.com" style="color:#0891b2">Contact us</a>
          </p>
          <p style="margin:8px 0 0;color:#9ca3af;font-size:10px;text-align:center">
            Spot the Phish · Cybersecurity Training Platform
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
  </body>
  </html>`;
}

/** Build a one-page PDF embedding the report PNG plus a text summary. */
async function buildPdf(name: string, f: ReportFields, pngBuffer: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pw = doc.page.width;
    const ph = doc.page.height;

    // Full-bleed background
    doc.fillColor('#0d0d1a').rect(0, 0, pw, ph).fill();

    // Header
    doc.fillColor('#22d3ee').fontSize(20).font('Helvetica-Bold').text('SPOT THE PHISH — Neural Assessment Report', 32, 28);
    doc.fillColor('#94a3b8').fontSize(11).font('Helvetica').text(`Agent: ${name}`, 32, 54);

    // Image on the left — fills from header to bottom edge
    const imgX = 32;
    const imgY = 80;
    const imgW = (pw - 100) / 2;
    const imgH = ph - imgY - 32;
    doc.image(pngBuffer, imgX, imgY, { fit: [imgW, imgH] });

    // Text panel on the right half
    const tx = imgX + imgW + 24;
    let y = imgY;
    const line = (label: string, value: string, color = '#e2e8f0') => {
      doc.fillColor('#94a3b8').fontSize(10).font('Helvetica').text(label, tx, y);
      doc.fillColor(color).fontSize(13).font('Helvetica-Bold').text(value, tx, y + 14);
      y += 40;
    };
    line('FINAL SCORE', `${f.compositeScore ?? '—'} PTS`, '#22d3ee');
    line('DESIGNATION', f.designation || '—', '#ec4899');
    line('READINESS', f.readinessLevel || '—');

    const textW = pw - tx - 32;
    if (f.strengths?.length) {
      doc.fillColor('#4ade80').fontSize(11).font('Helvetica-Bold').text('Key Strengths', tx, y);
      y += 16;
      doc.fillColor('#e2e8f0').fontSize(9).font('Helvetica');
      f.strengths.forEach((s) => { doc.text(`• ${s}`, tx, y, { width: textW }); y += 22; });
    }
    if (f.weaknesses?.length) {
      doc.fillColor('#facc15').fontSize(11).font('Helvetica-Bold').text('Areas for Improvement', tx, y);
      y += 16;
      doc.fillColor('#e2e8f0').fontSize(9).font('Helvetica');
      f.weaknesses.forEach((s) => { doc.text(`• ${s}`, tx, y, { width: textW }); y += 22; });
    }

    doc.end();
  });
}

/**
 * Email a finished report. The recipient is ALWAYS resolved from the persisted
 * player/session email — never from an arbitrary client-supplied address — to
 * prevent relay abuse and header injection.
 */
export async function sendReportEmail(sessionId: string, fields: ReportFields, pngBase64: string): Promise<SendReportResult> {
  const session = await GameSession.findOne({ sessionId });
  let to = session?.email;

  // Fallback 1: look up Player by the session's player ObjectId reference
  if (!to && session?.player) {
    const player = await Player.findById(session.player).lean();
    to = player?.email;
  }

  // Fallback 2: look up Player by sessionId's playerId string (handles cases
  // where the ObjectId ref is broken or the session was created before the Player had an email)
  if (!to && session?.playerId) {
    const player = await Player.findOne({ playerId: session.playerId }).lean();
    to = player?.email;
    // Also backfill the session's email for future lookups
    if (to && session) {
      await GameSession.updateOne({ _id: session._id }, { $set: { email: to } }).catch(() => undefined);
    }
  }

  if (!to) {
    logger.error(`[sendReportEmail] No email found — sessionId=${sessionId}, sessionEmail=${session?.email}, sessionPlayer=${session?.player}, sessionPlayerId=${session?.playerId}`);
    throw ApiError.unprocessable('No email address on file — cannot send the report');
  }
  logger.info(`[sendReportEmail] Sending report to ${to} for session ${sessionId}`);

  // Strip the data-URL prefix if the client sent a full data URL.
  const base64 = pngBase64.replace(/^data:image\/\w+;base64,/, '');
  const pngBuffer = Buffer.from(base64, 'base64');

  // Fetch the live codename from the Player model (single source of truth).
  let name = 'ANONYMOUS';
  if (session?.player) {
    const player = await Player.findById(session.player).lean();
    if (player?.name) name = player.name;
  }

  const attachments: Array<{ filename: string; content: Buffer; cid?: string; contentType: string }> = [
    { filename: 'spot-the-phish-report.png', content: pngBuffer, contentType: 'image/png' },
  ];

  if (env.ENABLE_PDF_REPORT) {
    try {
      const pdfBuffer = await buildPdf(name, fields, pngBuffer);
      attachments.push({ filename: 'spot-the-phish-report.pdf', content: pdfBuffer, contentType: 'application/pdf' });
    } catch (err) {
      logger.warn('PDF generation failed, sending PNG only:', (err as Error).message);
    }
  }

  let info;
  try {
    const subject = `Your Spot the Phish report — ${name} (${fields.compositeScore ?? ''} PTS)`.trim();
    const textBody = [
      `SPOT THE PHISH — Neural Assessment Report`,
      ``,
      `Agent: ${name}`,
      `Final Score: ${fields.compositeScore ?? '—'} PTS`,
      `Designation: ${fields.designation || '—'}`,
      `Readiness: ${fields.readinessLevel || '—'}`,
      `Threats caught: ${fields.threatsCaughtPct ?? '—'}%`,
      ``,
      fields.reportSummary ? `Summary: ${fields.reportSummary}` : '',
      ``,
      `Key Strengths:`,
      ...(fields.strengths || []).map(s => `  • ${s}`),
      ``,
      `Areas for Improvement:`,
      ...(fields.weaknesses || []).map(s => `  • ${s}`),
      ``,
      `INITIATE YOUR OWN ASSESSMENT · SPOT THE PHISH`,
    ].filter(Boolean).join('\n');

    info = await getMailer().sendMail({
      from: getFromAddress(),
      replyTo: to,
      to,
      subject,
      text: textBody,
      html: buildHtml(name, fields),
      headers: {
        'List-Unsubscribe': `<mailto:spotthephish@gmail.com?subject=unsubscribe>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
      attachments,
    });
  } catch (err) {
    logger.error('SMTP sendMail failed:', (err as Error).message);
    throw ApiError.serviceUnavailable(`Email delivery failed: ${(err as Error).message}`);
  }

  // nodemailer stamps a preview URL on ethereal messages in dev.
  const previewUrl = (info as unknown as { previewUrl?: string })?.previewUrl;
  if (previewUrl) logger.info(`📧 Report email preview: ${previewUrl}`);

  return { messageId: info.messageId, previewUrl, to };
}
