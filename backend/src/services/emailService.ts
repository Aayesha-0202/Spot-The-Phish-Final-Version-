import PDFDocument from 'pdfkit';
import { GameSession } from '../models/GameSession';
import { Player } from '../models/Player';
import { ApiError } from '../utils/ApiError';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { getMailer, getFromAddress } from '../config/mailer';

export interface ReportFields {
  playerName?: string;
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
  const list = (items: string[] | undefined, cls: string) =>
    items && items.length
      ? `<ul style="margin:6px 0;padding-left:20px;font-family:monospace;font-size:13px;color:#e2e8f0">${items
          .map((i) => `<li style="margin:4px 0">${escapeHtml(i)}</li>`)
          .join('')}</ul>`
      : `<p style="font-family:monospace;font-size:13px;color:#64748b">—</p>`;

  return `
  <div style="background:#0d0d1a;padding:32px;border-radius:8px;max-width:600px;margin:0 auto;color:#e2e8f0">
    <h1 style="font-family:Arial,sans-serif;color:#22d3ee;letter-spacing:2px;margin:0 0 4px">SPOT THE PHISH</h1>
    <p style="font-family:monospace;color:#94a3b8;margin:0 0 24px">Neural Assessment Report</p>
    <h2 style="font-family:Arial,sans-serif;color:#ffffff">Agent: <span style="color:#facc15">${escapeHtml(name)}</span></h2>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-family:Arial,sans-serif">
      <tr><td style="padding:8px;color:#94a3b8">Final Score</td><td style="padding:8px;font-weight:bold;color:#22d3ee;font-size:20px">${f.compositeScore ?? '—'} PTS</td></tr>
      <tr><td style="padding:8px;color:#94a3b8">Designation</td><td style="padding:8px;color:#ec4899;font-weight:bold">${escapeHtml(f.designation || '—')}</td></tr>
      <tr><td style="padding:8px;color:#94a3b8">Readiness</td><td style="padding:8px;color:#ffffff">${escapeHtml(f.readinessLevel || '—')}</td></tr>
      <tr><td style="padding:8px;color:#94a3b8">Threats caught</td><td style="padding:8px;color:#ffffff">${f.threatsCaughtPct ?? '—'}%</td></tr>
    </table>
    ${f.reportSummary ? `<p style="font-family:monospace;font-size:13px;color:#cbd5e1;background:#11111f;padding:12px;border-left:3px solid #22d3ee">${escapeHtml(f.reportSummary)}</p>` : ''}
    <h3 style="font-family:Arial,sans-serif;color:#4ade80;margin-top:20px">Key Strengths</h3>${list(f.strengths, 'green')}
    <h3 style="font-family:Arial,sans-serif;color:#facc15">Areas for Improvement</h3>${list(f.weaknesses, 'yellow')}
    <img src="cid:reportImage@stp" alt="Report card" style="width:100%;max-width:560px;border:2px solid #22d3ee;border-radius:6px;margin-top:20px" />
    <p style="font-family:monospace;font-size:11px;color:#64748b;margin-top:24px">INITIATE YOUR OWN ASSESSMENT · SPOT THE PHISH</p>
  </div>`;
}

/** Build a one-page PDF embedding the report PNG plus a text summary. */
async function buildPdf(name: string, f: ReportFields, pngBuffer: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 40 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fillColor('#0d0d1a').rect(0, 0, doc.page.width, doc.page.height).fill();

    doc.fillColor('#22d3ee').fontSize(20).font('Helvetica-Bold').text('SPOT THE PHISH — Neural Assessment Report', 40, 36);
    doc.fillColor('#94a3b8').fontSize(11).font('Helvetica').text(`Agent: ${name}`, 40, 64);

    // Image on the left half.
    const imgW = (doc.page.width - 120) / 2;
    doc.image(pngBuffer, 40, 90, { fit: [imgW, doc.page.height - 140] });

    // Text panel on the right half.
    let y = 100;
    const tx = 40 + imgW + 20;
    const line = (label: string, value: string, color = '#e2e8f0') => {
      doc.fillColor('#94a3b8').fontSize(10).font('Helvetica').text(label, tx, y);
      doc.fillColor(color).fontSize(13).font('Helvetica-Bold').text(value, tx, y + 14);
      y += 40;
    };
    line('FINAL SCORE', `${f.compositeScore ?? '—'} PTS`, '#22d3ee');
    line('DESIGNATION', f.designation || '—', '#ec4899');
    line('READINESS', f.readinessLevel || '—');

    if (f.strengths?.length) {
      doc.fillColor('#4ade80').fontSize(11).font('Helvetica-Bold').text('Key Strengths', tx, y);
      y += 16;
      doc.fillColor('#e2e8f0').fontSize(9).font('Helvetica');
      f.strengths.forEach((s) => { doc.text(`• ${s}`, tx, y, { width: imgW - 10 }); y += 24; });
    }
    if (f.weaknesses?.length) {
      doc.fillColor('#facc15').fontSize(11).font('Helvetica-Bold').text('Areas for Improvement', tx, y);
      y += 16;
      doc.fillColor('#e2e8f0').fontSize(9).font('Helvetica');
      f.weaknesses.forEach((s) => { doc.text(`• ${s}`, tx, y, { width: imgW - 10 }); y += 24; });
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
  if (!to && session?.player) {
    const player = await Player.findById(session.player).lean();
    to = player?.email;
  }
  if (!to) throw ApiError.unprocessable('No email address on file — cannot send the report');

  // Strip the data-URL prefix if the client sent a full data URL.
  const base64 = pngBase64.replace(/^data:image\/\w+;base64,/, '');
  const pngBuffer = Buffer.from(base64, 'base64');

  const name = fields.playerName || 'ANONYMOUS';

  const attachments: Array<{ filename: string; content: Buffer; cid?: string; contentType: string }> = [
    { filename: 'spot-the-phish-report.png', content: pngBuffer, cid: 'reportImage@stp', contentType: 'image/png' },
  ];

  if (env.ENABLE_PDF_REPORT) {
    try {
      const pdfBuffer = await buildPdf(name, fields, pngBuffer);
      attachments.push({ filename: 'spot-the-phish-report.pdf', content: pdfBuffer, contentType: 'application/pdf' });
    } catch (err) {
      logger.warn('PDF generation failed, sending PNG only:', (err as Error).message);
    }
  }

  const info = await getMailer().sendMail({
    from: getFromAddress(),
    to,
    subject: `Your Spot the Phish report — ${name} (${fields.compositeScore ?? ''} PTS)`.trim(),
    html: buildHtml(name, fields),
    attachments,
  });

  // nodemailer stamps a preview URL on ethereal messages in dev.
  const previewUrl = (info as unknown as { previewUrl?: string })?.previewUrl;
  if (previewUrl) logger.info(`📧 Report email preview: ${previewUrl}`);

  return { messageId: info.messageId, previewUrl, to };
}
