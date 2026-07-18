import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../../store/gameStore';
import { useAuthStore } from '../../store/authStore';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { Download, Linkedin, MessageCircle, Crosshair, Award, CheckCircle, AlertTriangle, Lightbulb, ShieldCheck, TrendingUp, Mail, Loader2, Trophy, Clock } from 'lucide-react';
import { analyzePerformance, PerformanceAnalysis } from '../../data/performance';

const READINESS_COLOR: Record<PerformanceAnalysis['readinessLevel'], string> = {
  ELITE: 'text-green-400 border-green-500/50 bg-green-500/10',
  HIGH: 'text-cyan-400 border-cyan-500/50 bg-cyan-500/10',
  MODERATE: 'text-yellow-400 border-yellow-500/50 bg-yellow-500/10',
  LOW: 'text-red-400 border-red-500/50 bg-red-500/10',
};

const barColor = (a: number) => (a >= 70 ? '#4ade80' : a >= 40 ? '#facc15' : '#f87171');

/**
 * Render the shareable 1080×1080 report directly to a canvas. Drawing via the
 * Canvas 2D API (instead of html2canvas) avoids Tailwind v4 `oklch()` parsing
 * failures and guarantees a clean, downloadable PNG every time.
 */
async function renderShareCard(canvas: HTMLCanvasElement, a: PerformanceAnalysis, playerName: string) {
  const W = 1080, H = 1080;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  try { await (document as any).fonts?.ready; } catch { /* fonts optional */ }

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#1a0b35');
  bg.addColorStop(1, '#0d0620');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Cyber grid
  ctx.strokeStyle = 'rgba(34,211,238,0.06)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 54) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y <= H; y += 54) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  // Frames
  ctx.strokeStyle = 'rgba(236,72,153,0.7)'; ctx.lineWidth = 14; ctx.strokeRect(14, 14, W - 28, H - 28);
  ctx.strokeStyle = 'rgba(34,211,238,0.45)'; ctx.lineWidth = 3; ctx.strokeRect(42, 42, W - 84, H - 84);

  const pad = 90;
  const contentW = W - pad * 2; // 900px usable
  const name = (playerName || 'ANONYMOUS').toUpperCase();

  // ===== HEADER (fixed top band) =====
  ctx.save();
  ctx.translate(pad + 34, 116);
  ctx.fillStyle = '#0d0d1a';
  ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.rect(-34, -34, 68, 68); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#22d3ee'; ctx.font = '700 32px Orbitron, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('◆', 0, 2);
  ctx.restore();
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = '#22d3ee'; ctx.font = '800 30px Orbitron, sans-serif';
  ctx.fillText('SPOT THE PHISH', pad + 88, 104);
  ctx.fillStyle = '#94a3b8'; ctx.font = '500 18px "JetBrains Mono", monospace';
  ctx.fillText('Neural Assessment Module', pad + 88, 130);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#facc15'; ctx.font = '700 20px "JetBrains Mono", monospace';
  ctx.fillText(`CODENAME: ${name}`, W - pad, 104);
  ctx.fillStyle = '#ec4899'; ctx.font = '700 20px Orbitron, sans-serif';
  ctx.fillText(a.designation.label, W - pad, 130);
  ctx.textAlign = 'left';

  // Everything below flows top→bottom; each section advances `y` by its measured
  // height so NO two sections can ever overlap.
  let y = 205;

  // ===== TITLE =====
  ctx.fillStyle = '#facc15'; ctx.font = '800 54px Orbitron, sans-serif';
  ctx.fillText('NEURAL ASSESSMENT', pad, y);
  y += 36;
  ctx.fillStyle = '#ec4899'; ctx.font = '500 22px "JetBrains Mono", monospace';
  ctx.fillText('> Final Phishing Detection Report', pad, y);
  y += 58;

  // ===== SCORE BLOCK =====
  ctx.fillStyle = '#22d3ee'; ctx.font = '700 22px Orbitron, sans-serif';
  ctx.fillText('FINAL SCORE', pad, y);
  ctx.font = '900 116px "JetBrains Mono", monospace';
  const numStr = String(a.compositeScore);
  const numW = ctx.measureText(numStr).width;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(numStr, pad, y + 104);
  ctx.fillStyle = '#64748b'; ctx.font = '700 32px "JetBrains Mono", monospace';
  ctx.fillText(' PTS', pad + numW + 8, y + 104);
  // quick stats on the right of the score band
  ctx.textAlign = 'right'; ctx.font = '600 19px "JetBrains Mono", monospace'; ctx.fillStyle = '#94a3b8';
  ctx.fillText(`Threats caught: ${a.threatsCaughtPct}%   ·   False alarms: ${a.falseAccusationRate}%`, W - pad, y + 44);
  ctx.fillText(`Verdict accuracy: ${a.stimulusAccuracy}%   ·   Readiness: ${a.readinessLevel}`, W - pad, y + 76);
  ctx.textAlign = 'left';
  y += 150;

  // ===== WHY THIS DESIGNATION (flows) =====
  ctx.fillStyle = '#ec4899'; ctx.font = '700 21px Orbitron, sans-serif';
  ctx.fillText('WHY THIS DESIGNATION', pad, y);
  y += 30;
  ctx.fillStyle = '#fbcfe8'; ctx.font = '500 20px "JetBrains Mono", monospace';
  y = drawWrapped(ctx, a.designationWhy, pad, y, contentW, 28);
  y += 26;

  // ===== TWO COLUMNS: Strengths / Areas to improve (advance by taller column) =====
  const colW = (contentW - 44) / 2; // ~428 each
  const leftX = pad;
  const rightX = pad + colW + 44;
  const colTop = y;
  ctx.fillStyle = '#4ade80'; ctx.font = '700 21px Orbitron, sans-serif';
  ctx.fillText('KEY STRENGTHS', leftX, colTop);
  ctx.fillStyle = '#facc15';
  ctx.fillText('AREAS TO IMPROVE', rightX, colTop);
  ctx.font = '400 18px "JetBrains Mono", monospace';
  const leftBottom = drawBullets(ctx, a.strengths.slice(0, 2), leftX, colTop + 30, colW, 24, '#4ade80', '#e2e8f0');
  const rightBottom = drawBullets(ctx, a.weaknesses.slice(0, 2), rightX, colTop + 30, colW, 24, '#facc15', '#e2e8f0');
  y = Math.max(leftBottom, rightBottom) + 28;

  // ===== READINESS SUMMARY (flows) =====
  ctx.strokeStyle = 'rgba(34,211,238,0.35)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W - pad, y); ctx.stroke();
  y += 30;
  ctx.fillStyle = '#22d3ee'; ctx.font = '700 21px Orbitron, sans-serif';
  ctx.fillText('PHISHING READINESS SUMMARY', pad, y);
  y += 30;
  ctx.fillStyle = '#e2e8f0'; ctx.font = '500 20px "JetBrains Mono", monospace';
  y = drawWrapped(ctx, a.readinessSummary, pad, y, contentW, 28);
  y += 24;

  // ===== FOOTER (pinned to bottom, but never above the flowing content) =====
  const footerY = Math.max(y + 16, H - 64);
  ctx.fillStyle = '#64748b'; ctx.font = '600 17px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('INITIATE YOUR OWN ASSESSMENT · SPOT THE PHISH', W / 2, footerY);
  ctx.textAlign = 'left';
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

// Draws wrapped text; returns the baseline of the next available line (the new `y`).
function drawWrapped(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
  const lines = wrapLines(ctx, text, maxWidth);
  lines.forEach((ln, i) => ctx.fillText(ln, x, y + i * lineHeight));
  return y + lines.length * lineHeight;
}

// Draws a bulleted list (dot + wrapped text); returns the y after the last bullet.
function drawBullets(ctx: CanvasRenderingContext2D, items: string[], x: number, y: number, maxWidth: number, lineHeight: number, dotColor: string, textColor: string): number {
  let cy = y;
  items.forEach(item => {
    ctx.fillStyle = dotColor;
    ctx.beginPath(); ctx.arc(x + 6, cy - 7, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = textColor;
    const lines = wrapLines(ctx, item, maxWidth - 24);
    lines.forEach((ln, i) => ctx.fillText(ln, x + 22, cy + i * lineHeight));
    cy += lines.length * lineHeight + 12;
  });
  return cy;
}

export const ResultsScreen = () => {
  const navigate = useNavigate();
  const { completionTimeMs, history, playerName, resetGame, playerEmail, reportEmailStatus, reportEmailMessage, sendReportEmail, lastFullyCompleted, rankedSessionId, scoreBreakdown, leaderboardRank, totalPlayers, isNewBest } = useGameStore();
  const [isExporting, setIsExporting] = useState(false);
  const sentRef = useRef(false);
  const [cardDataUrl, setCardDataUrl] = useState<string | null>(null);

  const analysis = useMemo<PerformanceAnalysis>(() => analyzePerformance(history, completionTimeMs || 0, scoreBreakdown.finalScore), [history, completionTimeMs, scoreBreakdown.finalScore]);

  // Render the share card once and auto-email it (no extra button click) if the
  // player gave an email. Guarded against React StrictMode double-invoke.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const canvas = document.createElement('canvas');
        await renderShareCard(canvas, analysis, playerName);
        if (cancelled) return;
        const dataUrl = canvas.toDataURL('image/png');
        setCardDataUrl(dataUrl);
        if (playerEmail.trim() && !sentRef.current) {
          sentRef.current = true;
          void sendReportEmail(dataUrl);
        }
      } catch (e) {
        console.error('Report render failed', e);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis, playerName]);

  const triggerDownload = (dataUrl: string) => {
    const link = document.createElement('a');
    const safeName = (playerName || 'agent').replace(/\s+/g, '-').toLowerCase();
    link.download = `spot-the-phish-${safeName}.png`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownload = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      let dataUrl = cardDataUrl;
      if (!dataUrl) {
        const canvas = document.createElement('canvas');
        await renderShareCard(canvas, analysis, playerName);
        dataUrl = canvas.toDataURL('image/png');
      }
      triggerDownload(dataUrl);
    } catch (e) {
      console.error('Download failed', e);
      alert('Sorry — the download failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const retryEmail = () => {
    if (!cardDataUrl) return;
    sentRef.current = false;
    useGameStore.setState({ reportEmailStatus: 'idle', reportEmailMessage: '' });
    void sendReportEmail(cardDataUrl);
  };

  const handleShare = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const canvas = document.createElement('canvas');
      await renderShareCard(canvas, analysis, playerName);
      canvas.toBlob(async (blob) => {
        if (!blob) { setIsExporting(false); return; }
        const file = new File([blob], 'spot-the-phish-score.png', { type: 'image/png' });
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          try {
            await navigator.share({
              title: `I scored ${analysis.compositeScore} on Spot the Phish!`,
              text: `I reached the rank of ${analysis.designation.label}. Can you beat my Neural Radar?`,
              files: [file],
            });
          } catch { /* user cancelled */ }
        } else {
          triggerDownload(canvas.toDataURL('image/png'));
          alert('Saved the image — attach it to your post to share.');
        }
        setIsExporting(false);
      }, 'image/png');
    } catch (e) {
      console.error('Share failed', e);
      setIsExporting(false);
    }
  };

  const shareText = `I just scored ${analysis.compositeScore} (${analysis.designation.label}) on "Spot the Phish". Can your Neural Radar beat mine?`;
  const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`;
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
  const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;

  return (
    <div className="flex flex-col items-center min-h-screen px-4 lg:px-12 py-12 relative z-10 w-full overflow-y-auto bg-cyber-grid bg-[#0d0d1a]">
      <div className="w-full max-w-7xl mx-auto flex flex-col gap-8">

        <div className="flex justify-between items-end border-b-2 border-cyan-400/30 pb-4">
          <div className="text-cyan-400 font-black tracking-[0.3em] uppercase font-display text-xl md:text-2xl">Assessment Complete // Telemetry Log</div>
          <div className="text-pink-500 font-mono uppercase tracking-widest text-xs border border-pink-500/30 px-3 py-1">Mission Success</div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Main Score Card */}
           <div className="cyber-clip-lg p-4 md:p-10 lg:col-span-2 flex flex-col shadow-2xl relative bg-[#0a0515] border-2 border-cyan-400 cyber-glow">
            <div className="z-10 relative">
               <div className="text-cyan-400 tracking-[0.3em] text-sm font-bold uppercase mb-1 font-display">Agent // {playerName?.trim() ? playerName : 'Anonymous'}</div>
               <div className="text-cyan-400 tracking-[0.3em] text-sm font-bold uppercase mb-2 font-display">Final Score</div>
               <div className="text-[3rem] md:text-[5rem] leading-none font-black text-white font-mono cyber-glow-text">
                 {analysis.compositeScore}<span className="text-2xl text-slate-500 font-mono align-top ml-2">PTS</span>
               </div>

               <div className="mt-6 flex flex-col md:flex-row gap-6">
                 <div className="bg-black/50 p-6 border-l-4 border-pink-500 flex-1 cyber-clip">
                   <div className="text-xs tracking-[0.2em] text-pink-500/70 font-bold uppercase mb-2">Assigned Designation</div>
                   <div className="text-3xl font-black text-pink-400 font-display tracking-widest uppercase">{analysis.designation.label}</div>
                 </div>
                 <div className={`p-6 border flex-1 cyber-clip ${READINESS_COLOR[analysis.readinessLevel]}`}>
                   <div className="text-xs tracking-[0.2em] font-bold uppercase mb-2 opacity-80">Phishing Readiness</div>
                   <div className="text-3xl font-black font-display tracking-widest">{analysis.readinessLevel}</div>
                 </div>
               </div>

               <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
                 {[
                   { k: 'Stimuli Correct', v: `${analysis.stimuliCorrect}/${analysis.stimuliTotal}` },
                   { k: 'Threats Caught', v: `${analysis.threatsCaughtPct}%` },
                   { k: 'False Alarms', v: `${analysis.falseAccusationRate}%` },
                   { k: 'Time Taken', v: analysis.completionTimeFormatted },
                 ].map(s => (
                   <div key={s.k} className="bg-black/40 p-3 border border-slate-800 cyber-clip text-center">
                     <div className="text-slate-500 text-[11px] font-bold uppercase tracking-widest">{s.k}</div>
                     <div className="text-lg font-mono font-bold text-white">{s.v}</div>
                   </div>
                 ))}
                </div>

                {/* Score Breakdown */}
                <div className="mt-6 bg-black/40 p-4 border border-slate-800 cyber-clip">
                  <div className="text-slate-500 text-[11px] font-bold uppercase tracking-widest mb-3">Score Breakdown</div>
                  <div className="space-y-2 font-mono text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Base Score ({analysis.stimuliCorrect}/{analysis.stimuliTotal} correct)</span>
                      <span className="text-white">{scoreBreakdown.baseScore}</span>
                    </div>
                    {scoreBreakdown.streakMultiplier > 1 && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Streak Multiplier</span>
                        <span className="text-yellow-400">{scoreBreakdown.streakMultiplier.toFixed(2)}×</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-400">Time Bonus</span>
                      <span className="text-cyan-400">+{scoreBreakdown.timeBonus}</span>
                    </div>
                    {scoreBreakdown.accuracyBonus > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Accuracy Bonus</span>
                        <span className="text-green-400">+{scoreBreakdown.accuracyBonus}</span>
                      </div>
                    )}
                    {scoreBreakdown.completionBonus > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Speed Bonus</span>
                        <span className="text-green-400">+{scoreBreakdown.completionBonus}</span>
                      </div>
                    )}
                    {scoreBreakdown.longestStreakBonus > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Streak Bonus</span>
                        <span className="text-pink-400">+{scoreBreakdown.longestStreakBonus}</span>
                      </div>
                    )}
                    <div className="border-t border-slate-700 pt-2 flex justify-between font-bold">
                      <span className="text-white">Final Score</span>
                      <span className="text-cyan-400 text-lg">{scoreBreakdown.finalScore}</span>
                    </div>
                  </div>
                </div>
            </div>
          </div>

          {/* Download / Share Card */}
          <div className="cyber-clip p-8 flex flex-col shadow-2xl bg-[#0a0515] border-2 border-yellow-400 cyber-glow-yellow">
            <div className="text-xl font-display font-black tracking-widest text-yellow-400 uppercase mb-4">Share Your Result</div>
            <p className="text-sm text-yellow-100/60 mb-6 leading-relaxed font-mono">
              Download a 1080×1080 report card with your score, designation, strengths and improvement areas — ready to post.
            </p>

            {/* Auto report-email status */}
            {playerEmail.trim() && reportEmailStatus !== 'skipped' && (
              <div
                className={`mb-4 p-3 border text-xs font-mono flex items-center gap-2 cyber-clip ${
                  reportEmailStatus === 'sent'
                    ? 'border-green-500/50 bg-green-500/10 text-green-300'
                    : reportEmailStatus === 'failed'
                      ? 'border-red-500/50 bg-red-500/10 text-red-300'
                      : 'border-yellow-500/40 bg-yellow-500/5 text-yellow-200/80'
                }`}
              >
                {reportEmailStatus === 'sending' && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
                {reportEmailStatus === 'sent' && <CheckCircle className="w-4 h-4 shrink-0" />}
                {reportEmailStatus === 'failed' && <AlertTriangle className="w-4 h-4 shrink-0" />}
                {reportEmailStatus === 'idle' && <Mail className="w-4 h-4 shrink-0" />}
                <span className="flex-1">
                  {reportEmailStatus === 'sent' && `✅ Report successfully sent to ${reportEmailMessage}`}
                  {reportEmailStatus === 'sending' && `Sending your report to ${reportEmailMessage}…`}
                  {reportEmailStatus === 'failed' && 'Couldn’t send the email — you can still download it below.'}
                  {reportEmailStatus === 'idle' && 'Preparing your report email…'}
                </span>
                {reportEmailStatus === 'failed' && (
                  <button onClick={retryEmail} className="underline hover:text-red-200 shrink-0">Retry</button>
                )}
              </div>
            )}

            {/* Ranked confirmation */}
            {rankedSessionId && lastFullyCompleted && (
              <div className="mb-4 p-3 border border-cyan-500/40 bg-cyan-500/10 text-cyan-200 text-xs font-mono flex flex-col gap-1 cyber-clip">
                <div className="flex items-center gap-2">
                  <Trophy /> Your score has been submitted to the global leaderboard.
                </div>
                {leaderboardRank && (
                  <div className="flex items-center gap-2 text-yellow-300">
                    <span className="font-black">#{leaderboardRank}</span>
                    {totalPlayers > 0 && <span>of {totalPlayers} players</span>}
                    {isNewBest && <span className="text-green-400 font-bold">— New Personal Best!</span>}
                  </div>
                )}
              </div>
            )}
            {lastFullyCompleted && (
              <button
                onClick={() => navigate('/leaderboard')}
                className="mb-4 w-full py-2 text-xs uppercase tracking-widest font-bold text-cyan-300 border border-cyan-500/40 cyber-clip hover:bg-cyan-500/20 transition-colors"
              >
                View Full Leaderboard
              </button>
            )}
            {!useAuthStore.getState().isAuthenticated && !useAuthStore.getState().isGuest && (
              <div className="mb-4 p-3 border border-yellow-500/40 bg-yellow-500/5 text-yellow-200/80 text-xs font-mono flex items-center gap-2 cyber-clip">
                <AlertTriangle /> Sign in to submit your score to the global leaderboard.
              </div>
            )}

            <div className="flex flex-col gap-4">
              <button onClick={handleDownload} disabled={isExporting} className="w-full cyber-clip gap-2 py-4 bg-yellow-400/10 border-2 border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-black font-bold uppercase tracking-widest transition-all flex justify-center items-center disabled:opacity-60">
                <Download className="w-5 h-5" />
                {isExporting ? 'Compiling...' : 'Download Asset'}
              </button>
              <button onClick={handleShare} disabled={isExporting} className="w-full cyber-clip gap-2 py-3 bg-cyan-400/10 border-2 border-cyan-400 text-cyan-300 hover:bg-cyan-400 hover:text-black font-bold uppercase tracking-widest transition-all flex justify-center items-center disabled:opacity-60">
                <Crosshair className="w-5 h-5" /> Share
              </button>

              <div className="grid grid-cols-3 gap-3">
                 <a href={linkedinUrl} target="_blank" rel="noopener noreferrer" className="cyber-clip flex flex-col items-center justify-center gap-1 p-3 bg-blue-600/20 border border-blue-500 hover:bg-blue-600/40 transition">
                   <Linkedin className="w-4 h-4 text-blue-400" />
                   <span className="text-[12px] uppercase tracking-widest font-bold text-white">LinkedIn</span>
                 </a>
                 <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="cyber-clip flex flex-col items-center justify-center gap-1 p-3 bg-green-600/20 border border-green-500 hover:bg-green-600/40 transition">
                   <MessageCircle className="w-4 h-4 text-green-400" />
                   <span className="text-[12px] uppercase tracking-widest font-bold text-white">WhatsApp</span>
                 </a>
                 <a href={xUrl} target="_blank" rel="noopener noreferrer" className="cyber-clip flex flex-col items-center justify-center gap-1 p-3 bg-white/10 border border-white/30 hover:bg-white/20 transition">
                   <span className="font-bold text-base leading-none text-white">𝕏</span>
                   <span className="text-[12px] uppercase tracking-widest font-bold text-white">Post</span>
                 </a>
              </div>

              <button onClick={resetGame} className="mt-4 w-full py-3 text-xs tracking-[0.2em] uppercase font-bold text-slate-400 border border-slate-700 hover:bg-slate-800 hover:text-white justify-center flex cyber-clip transition-colors">
                Reboot Sequence
              </button>
            </div>
          </div>

          {/* Cognitive Threat Diagnostics Panel — MOVED ABOVE Performance Report */}
          <div className="cyber-clip-lg p-8 lg:col-span-3 bg-[#0a0515] border-2 border-cyan-500/60 space-y-8">
            <div className="flex items-center gap-3">
              <Crosshair className="w-7 h-7 text-cyan-400" />
              <h3 className="text-2xl md:text-3xl font-display font-black text-cyan-300 uppercase tracking-widest">Cognitive Diagnostics</h3>
            </div>

            {/* 1. Key Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { label: 'Attention to Detail', val: `${analysis.attentionToDetail}%`, desc: 'Cues successfully identified', color: 'text-pink-400' },
                { label: 'Classification Accuracy', val: `${analysis.accuracy}%`, desc: 'Element-level classification accuracy', color: 'text-cyan-400' },
                { label: 'Investigation Efficiency', val: `${analysis.efficiency}%`, desc: 'Weighted speed + accuracy index', color: 'text-yellow-400' },
                { label: 'Total Duration', val: analysis.completionTimeFormatted, desc: 'Continuous elapsed time', color: 'text-green-400' }
              ].map((m) => (
                <div key={m.label} className="bg-black/50 p-4 md:p-8 border-t-2 border-slate-700/60 rounded-lg text-center space-y-3 hover:border-cyan-500/40 transition-colors">
                  <div className="text-slate-400 text-sm font-bold uppercase tracking-wider">{m.label}</div>
                  <div className={`text-4xl md:text-5xl font-black font-mono ${m.color}`}>{m.val}</div>
                  <div className="text-slate-500 text-xs uppercase font-mono tracking-widest">{m.desc}</div>
                </div>
              ))}
            </div>

            {/* 2. Visual Rates & Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-black/40 p-6 border border-slate-800 rounded-lg flex flex-col justify-between space-y-4">
                <h4 className="text-pink-400 font-bold uppercase tracking-wider text-sm">Threat Detection Rate</h4>
                <div className="flex items-center gap-4">
                  <div className="relative w-24 h-24 shrink-0">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="48" cy="48" r="40" className="stroke-slate-800" strokeWidth="6" fill="transparent" />
                      <circle cx="48" cy="48" r="40" className="stroke-pink-500" strokeWidth="6" fill="transparent" strokeDasharray={251.3} strokeDashoffset={251.3 - (251.3 * analysis.threatDetectionRate) / 100} />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center font-mono font-bold text-white text-lg">
                      {analysis.threatDetectionRate}%
                    </div>
                  </div>
                  <p className="text-slate-400 text-sm font-mono leading-relaxed">
                    Percentage of phishing emails/messages correctly flagged as threats.
                  </p>
                </div>
              </div>

              <div className="bg-black/40 p-6 border border-slate-800 rounded-lg flex flex-col justify-between space-y-4">
                <h4 className="text-green-400 font-bold uppercase tracking-wider text-sm">Safe Verification Rate</h4>
                <div className="flex items-center gap-4">
                  <div className="relative w-24 h-24 shrink-0">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="48" cy="48" r="40" className="stroke-slate-800" strokeWidth="6" fill="transparent" />
                      <circle cx="48" cy="48" r="40" className="stroke-green-500" strokeWidth="6" fill="transparent" strokeDasharray={251.3} strokeDashoffset={251.3 - (251.3 * analysis.safeDetectionRate) / 100} />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center font-mono font-bold text-white text-lg">
                      {analysis.safeDetectionRate}%
                    </div>
                  </div>
                  <p className="text-slate-400 text-sm font-mono leading-relaxed">
                    Percentage of legitimate messages correctly cleared as safe.
                  </p>
                </div>
              </div>

              <div className="bg-black/40 p-6 border border-slate-800 rounded-lg flex flex-col justify-between space-y-4">
                <h4 className="text-cyan-400 font-bold uppercase tracking-wider text-sm">Classification Breakdown</h4>
                <div className="space-y-3">
                  <div className="flex justify-between font-mono text-sm">
                    <span className="text-slate-400">CORRECT ELEMENTS:</span>
                    <span className="text-green-400 font-bold">{analysis.correctClassifications}</span>
                  </div>
                  <div className="flex justify-between font-mono text-sm">
                    <span className="text-slate-400">INCORRECT ELEMENTS:</span>
                    <span className="text-red-400 font-bold">{analysis.incorrectClassifications}</span>
                  </div>
                  <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden flex">
                    <div className="h-full bg-green-500" style={{ width: `${(analysis.correctClassifications / Math.max(1, analysis.correctClassifications + analysis.incorrectClassifications)) * 100}%` }} />
                    <div className="h-full bg-red-500" style={{ width: `${(analysis.incorrectClassifications / Math.max(1, analysis.correctClassifications + analysis.incorrectClassifications)) * 100}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Inferred Soft Skills */}
            <div className="bg-black/30 p-6 border border-cyan-500/20 rounded-lg space-y-3">
              <h4 className="text-cyan-300 font-bold uppercase tracking-wider text-sm font-display">Inferred Cognitive Profile</h4>
              <div className="flex flex-wrap gap-2">
                {analysis.softSkills.map((skill) => (
                  <span key={skill} className="px-3 py-1.5 rounded-full text-sm font-mono font-bold uppercase bg-cyan-950/60 text-cyan-300 border border-cyan-500/30">
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            {/* 4. Pressure Analysis — IMPROVED UI */}
            <div className="bg-gradient-to-r from-[#180a20] to-[#0d0722] p-8 border-l-4 border-pink-500 rounded-r-lg space-y-3">
              <h4 className="text-pink-400 font-bold uppercase tracking-wider text-lg font-display">Stress Tolerance & Stamina Analysis</h4>
              <p className="text-slate-200 text-base md:text-lg leading-loose font-mono">
                {analysis.pressureAnalysis}
              </p>
            </div>
          </div>

          {/* Personalized Performance Report — NOW BELOW Cognitive Diagnostics */}
          <div className="cyber-clip-lg p-8 lg:col-span-3 bg-[#0a0515] border-2 border-cyan-500/60">
            <div className="flex items-center gap-3 mb-6">
              <Award className="w-7 h-7 text-cyan-400" />
              <h3 className="text-2xl md:text-3xl font-display font-black text-cyan-300 uppercase tracking-widest">Performance Report</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-black/40 p-5 border-l-4 border-pink-500">
                <div className="text-pink-400 text-[12px] font-bold uppercase tracking-[0.2em] mb-2">Why you earned "{analysis.designation.label}"</div>
                <p className="text-slate-200 text-sm leading-relaxed font-mono">{analysis.designationWhy}</p>
              </div>
              <div className="bg-black/40 p-5 border-l-4 border-cyan-400">
                <div className="text-cyan-400 text-[12px] font-bold uppercase tracking-[0.2em] mb-2">Overall Summary</div>
                <p className="text-slate-200 text-sm leading-relaxed font-mono">{analysis.summary}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
              <div className="bg-black/30 p-5 border border-green-500/30">
                <div className="flex items-center gap-2 mb-3"><CheckCircle className="w-5 h-5 text-green-400" /><span className="text-green-400 text-xs font-black uppercase tracking-widest">Strengths</span></div>
                <ul className="space-y-2">
                  {analysis.strengths.map((s, i) => <li key={i} className="text-slate-300 text-xs leading-relaxed font-mono flex gap-2"><span className="text-green-400">▸</span>{s}</li>)}
                </ul>
              </div>
              <div className="bg-black/30 p-5 border border-yellow-500/30">
                <div className="flex items-center gap-2 mb-3"><AlertTriangle className="w-5 h-5 text-yellow-400" /><span className="text-yellow-400 text-xs font-black uppercase tracking-widest">Weaknesses</span></div>
                <ul className="space-y-2">
                  {analysis.weaknesses.map((s, i) => <li key={i} className="text-slate-300 text-xs leading-relaxed font-mono flex gap-2"><span className="text-yellow-400">▸</span>{s}</li>)}
                </ul>
              </div>
              <div className="bg-black/30 p-5 border border-cyan-500/30">
                <div className="flex items-center gap-2 mb-3"><Lightbulb className="w-5 h-5 text-cyan-400" /><span className="text-cyan-400 text-xs font-black uppercase tracking-widest">Recommendations</span></div>
                <ul className="space-y-2">
                  {analysis.recommendations.map((s, i) => <li key={i} className="text-slate-300 text-xs leading-relaxed font-mono flex gap-2"><span className="text-cyan-400">▸</span>{s}</li>)}
                </ul>
              </div>
            </div>

            <div className="mt-6 flex items-start gap-3 bg-cyan-950/30 border border-cyan-500/30 p-4">
              <ShieldCheck className="w-5 h-5 text-cyan-300 shrink-0 mt-0.5" />
              <p className="text-cyan-100 text-sm leading-relaxed font-mono">{analysis.readinessSummary}</p>
            </div>
          </div>

          {/* Threat Radar (category) + interpretation */}
          <div className="cyber-clip-lg p-8 lg:col-span-3 flex flex-col md:flex-row gap-8 items-center bg-[#0a0515] border-2 border-pink-500 cyber-glow-pink">
            <div className="md:w-1/3 space-y-4">
              <h3 className="text-2xl font-display font-black text-pink-500 uppercase tracking-widest">Threat Radar</h3>
              <p className="text-pink-100/70 leading-relaxed text-xs font-mono">{analysis.radarInterpretation}</p>
              <div className="pt-2 flex flex-col gap-2">
                {analysis.categoryStats.map(c => (
                  <div key={c.category} className="flex justify-between items-center text-[12px] uppercase font-bold tracking-widest">
                    <span className="text-slate-400">{c.category}</span>
                    <span className={c.total === 0 ? 'text-slate-600' : c.accuracy > 70 ? 'text-cyan-400' : c.accuracy > 40 ? 'text-yellow-400' : 'text-red-400'}>
                      {c.total === 0 ? '—' : `${c.accuracy}%`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="w-full md:w-2/3 h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="75%" data={analysis.radarData}>
                  <PolarGrid stroke="rgba(255,0,127,0.3)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(255,0,127,0.85)', fontSize: 12, fontWeight: 'bold', fontFamily: 'Orbitron' }} />
                  <Radar name="Accuracy" dataKey="A" stroke="#00ffff" strokeWidth={3} fill="#00ffff" fillOpacity={0.2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Level Performance + interpretation */}
          <div className="cyber-clip-lg p-8 lg:col-span-3 flex flex-col md:flex-row gap-8 items-center bg-[#0a0515] border-2 border-cyan-400 cyber-glow">
            <div className="md:w-1/3 space-y-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-cyan-400" />
                <h3 className="text-2xl font-display font-black text-cyan-300 uppercase tracking-widest">Level Progression</h3>
              </div>
              <p className="text-cyan-100/70 leading-relaxed text-xs font-mono">{analysis.levelInterpretation}</p>
              <p className="text-slate-500 text-[12px] uppercase tracking-widest font-bold">Accuracy (%) across the five difficulty levels</p>
            </div>
            <div className="w-full md:w-2/3 h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analysis.levelData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(34,211,238,0.1)" vertical={false} />
                  <XAxis dataKey="level" tick={{ fill: '#22d3ee', fontSize: 12, fontWeight: 'bold' }} axisLine={{ stroke: 'rgba(34,211,238,0.3)' }} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: 'rgba(34,211,238,0.08)' }} contentStyle={{ background: '#0d0d1a', border: '1px solid rgba(34,211,238,0.4)', color: '#fff', borderRadius: 0, fontSize: 12 }} formatter={(v: number) => [`${v}%`, 'Accuracy']} />
                  <Bar dataKey="accuracy" radius={[4, 4, 0, 0]}>
                    {analysis.levelData.map((d, i) => <Cell key={i} fill={barColor(d.accuracy)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export const ComputingScreen = () => (
  <div className="flex flex-col items-center justify-center min-h-screen z-10 text-center w-full bg-[#0d0d1a] bg-cyber-grid">
     <div className="w-32 h-32 mb-12 relative flex justify-center items-center">
       <div className="absolute inset-0 border-[6px] border-slate-800 rounded-full cyber-clip"></div>
       <div className="absolute inset-0 border-[6px] border-t-cyan-400 border-r-cyan-400 border-b-transparent border-l-transparent rounded-full animate-spin cyber-glow"></div>
       <div className="absolute inset-4 border-2 border-dashed border-pink-500 rounded-full animate-spin-slow"></div>
       <Crosshair className="w-10 h-10 text-cyan-400 animate-pulse" />
     </div>
     <div className="text-3xl md:text-5xl font-display font-black text-cyan-400 tracking-[0.3em] uppercase animate-pulse mb-6 cyber-glow-text">
       Compiling Telemetry
     </div>
     <div className="text-pink-400 font-mono tracking-widest uppercase text-sm border-y border-pink-500/30 py-2 px-8">
       Analyzing Neural Threat Data...
     </div>
  </div>
);
