import { GameHistoryEntry, ElementId, ElementData } from '../types';
import { GAME_STIMULI } from './stimuli';
import { computeTotalScore, CORRECT_STIMULUS_POINTS } from './scoring';

const ELEMENT_IDS: ElementId[] = ['sender', 'content', 'actionUrl', 'actionText', 'amount'];

const RADAR_AXES = ['Sender Identity', 'Links & URLs', 'Urgency/Pressure', 'Safe Verification', 'Other Anomalies'] as const;

function reasonToAxis(reason?: string): string {
  if (reason === 'Fake Sender/Identity' || reason === 'Impersonation or Fake Branding') return 'Sender Identity';
  if (reason === 'Suspicious Link or URL') return 'Links & URLs';
  if (reason === 'Urgency or Pressure Tactic') return 'Urgency/Pressure';
  return 'Other Anomalies';
}

export interface DesignationInfo {
  label: string;
  tier: number; // 1 (best) … 5 (rookie)
  blurb: string;
}

export function getDesignation(compositeScore: number, health: number): DesignationInfo {
  if (compositeScore > 210 && health >= 80) return { label: 'NETRUNNER SUPREME', tier: 1, blurb: 'Elite threat-intel operator.' };
  if (compositeScore > 160) return { label: 'ELITE HACKER', tier: 2, blurb: 'Sharp, consistent investigator.' };
  if (compositeScore > 110) return { label: 'CYBER SEC PRO', tier: 3, blurb: 'Solid, dependable judgement.' };
  if (compositeScore > 60) return { label: 'VIGILANT NODE', tier: 4, blurb: 'Getting there — keep training.' };
  return { label: 'ROOKIE', tier: 5, blurb: 'Just getting started.' };
}

export interface CategoryStat { category: string; correct: number; total: number; accuracy: number; }
export interface TierStat { level: number; correct: number; total: number; accuracy: number; reached: boolean; }

export interface PerformanceAnalysis {
  compositeScore: number;
  designation: DesignationInfo;
  designationWhy: string;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  readinessSummary: string;
  readinessLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'ELITE';
  // raw stats
  stimuliTotal: number;
  stimuliCorrect: number;
  stimulusAccuracy: number;
  threatsTotal: number;
  threatsCaught: number;
  threatsCaughtPct: number;
  safeTotal: number;
  safeCorrect: number;
  safeCorrectPct: number;
  falseAccusations: number;
  falseAccusationRate: number;
  // graphs
  radarData: { subject: string; A: number; fullMark: number }[];
  categoryStats: CategoryStat[];
  strongestCategory?: string;
  weakestCategory?: string;
  radarInterpretation: string;
  levelData: { level: string; accuracy: number }[];
  tierStats: TierStat[];
  levelInterpretation: string;
  basePointsPerCorrect: number;
}

function pct(n: number, d: number): number {
  return d > 0 ? Math.round((n / d) * 100) : 0;
}

export function analyzePerformance(history: GameHistoryEntry[], health: number): PerformanceAnalysis {
  const compositeScore = computeTotalScore(history);

  // Per-element tally across the whole run.
  const axisTotals: Record<string, { correct: number; total: number }> = {};
  RADAR_AXES.forEach(a => (axisTotals[a] = { correct: 0, total: 0 }));

  const tierMap: Record<number, { correct: number; total: number }> = { 1: { correct: 0, total: 0 }, 2: { correct: 0, total: 0 }, 3: { correct: 0, total: 0 }, 4: { correct: 0, total: 0 }, 5: { correct: 0, total: 0 } };

  let threatsTotal = 0, threatsCaught = 0;
  let safeTotal = 0, safeCorrect = 0, falseAccusations = 0;

  history.forEach(h => {
    const stimulus = GAME_STIMULI.find(s => s.id === h.stimulusId);
    if (!stimulus) return;

    if (tierMap[stimulus.difficultyTier]) {
      tierMap[stimulus.difficultyTier].total++;
      if (h.isCorrect) tierMap[stimulus.difficultyTier].correct++;
    }

    ELEMENT_IDS.forEach(id => {
      const el = (stimulus as unknown) as Record<string, ElementData | undefined>;
      const trueEl = el[id];
      if (!trueEl) return;
      const inv = h.investigations[id];
      const status = inv?.status;

      if (trueEl.isSuspicious) {
        const axis = reasonToAxis(trueEl.reason);
        axisTotals[axis].total++;
        threatsTotal++;
        if (status === 'SUSPICIOUS') { axisTotals[axis].correct++; threatsCaught++; }
      } else {
        axisTotals['Safe Verification'].total++;
        safeTotal++;
        if (status === 'SAFE') { axisTotals['Safe Verification'].correct++; safeCorrect++; }
        if (status === 'SUSPICIOUS') falseAccusations++;
      }
    });
  });

  const stimuliTotal = history.length;
  const stimuliCorrect = history.filter(h => h.isCorrect).length;

  const categoryStats: CategoryStat[] = RADAR_AXES.map(a => ({
    category: a,
    correct: axisTotals[a].correct,
    total: axisTotals[a].total,
    accuracy: pct(axisTotals[a].correct, axisTotals[a].total),
  }));

  const radarData = RADAR_AXES.map(a => ({
    subject: a,
    A: axisTotals[a].total > 0 ? pct(axisTotals[a].correct, axisTotals[a].total) : 0,
    fullMark: 100,
  }));

  // Strongest / weakest only among axes the player actually encountered.
  const seenAxes = categoryStats.filter(c => c.total > 0);
  const strongest = seenAxes.length ? seenAxes.reduce((a, b) => (a.accuracy >= b.accuracy ? a : b)) : undefined;
  const weakest = seenAxes.length ? seenAxes.reduce((a, b) => (a.accuracy <= b.accuracy ? a : b)) : undefined;

  // Per-level stats (mark unreached levels).
  const tierStats: TierStat[] = [1, 2, 3, 4, 5].map(level => {
    const t = tierMap[level];
    const reached = t.total > 0;
    return { level, correct: t.correct, total: t.total, reached, accuracy: reached ? pct(t.correct, t.total) : 0 };
  });
  const levelData = tierStats.map(t => ({ level: `L${t.level}`, accuracy: t.accuracy }));

  const threatsCaughtPct = pct(threatsCaught, threatsTotal);
  const safeCorrectPct = pct(safeCorrect, safeTotal);
  const falseAccusationRate = pct(falseAccusations, safeTotal);
  const stimulusAccuracy = pct(stimuliCorrect, stimuliTotal);

  const designation = getDesignation(compositeScore, health);

  // --- Strengths ---
  const strengths: string[] = [];
  if (stimulusAccuracy >= 70) strengths.push(`Strong overall verdict accuracy — ${stimuliCorrect} of ${stimuliTotal} stimuli read correctly (${stimulusAccuracy}%).`);
  if (threatsCaughtPct >= 75 && threatsTotal > 0) strengths.push(`Reliably spotted malicious cues, catching ${threatsCaught} of ${threatsTotal} threats (${threatsCaughtPct}%).`);
  if (strongest && strongest.accuracy >= 75) strengths.push(`Best detection area: ${strongest.category.toLowerCase()} (${strongest.accuracy}% accuracy).`);
  if (safeCorrectPct >= 75 && safeTotal > 0) strengths.push(`Good at verifying legitimate messages — ${safeCorrectPct}% correctly cleared as safe.`);
  if (falseAccusationRate <= 10 && safeTotal > 0) strengths.push(`Disciplined judgement: only ${falseAccusations} false accusation${falseAccusations === 1 ? '' : 's'} across ${safeTotal} safe elements.`);
  if (strengths.length === 0) strengths.push('You engaged with every case — that willingness to investigate is the right instinct to build on.');

  // --- Weaknesses ---
  const weaknesses: string[] = [];
  if (stimulusAccuracy < 50 && stimuliTotal > 0) weaknesses.push(`Overall verdict accuracy was low (${stimulusAccuracy}%) — several scams slipped through.`);
  if (threatsCaughtPct < 60 && threatsTotal > 0) weaknesses.push(`Missed a notable share of threats — ${threatsTotal - threatsCaught} of ${threatsTotal} malicious cues went unflagged.`);
  if (weakest && weakest.accuracy < 60 && seenAxes.length > 1) weaknesses.push(`Weakest detection area: ${weakest.category.toLowerCase()} (${weakest.accuracy}% accuracy).`);
  if (falseAccusationRate > 25 && safeTotal > 0) weaknesses.push(`Tendency to over-flag — ${falseAccusations} safe element${falseAccusations === 1 ? '' : 's'} wrongly marked as threats (${falseAccusationRate}%).`);
  if (weaknesses.length === 0) weaknesses.push(`No single weak spot stood out — aim to push your strongest areas even higher.`);

  // --- Recommendations ---
  const recommendations: string[] = [];
  if (weakest && seenAxes.length > 0) recommendations.push(`Brush up on ${weakest.category.toLowerCase()} indicators — re-read the case explanations for the ones you missed.`);
  if (threatsCaughtPct < 75 && threatsTotal > 0) recommendations.push(`Slow down on urgent payment, KYC and delivery messages; verify the sender/domain before trusting urgency.`);
  if (falseAccusationRate > 20) recommendations.push(`Before flagging, confirm the sender domain and link destination — over-flagging wastes trust.`);
  if (stimulusAccuracy < 70) recommendations.push(`Replay a level to pattern-match against common phish structures (lookalike domains, masked shortcodes).`);
  recommendations.push(`Keep your “trust but verify” habit: hover links, check sender handles, and never share OTPs.`);
  // de-dup + cap
  const uniqueRecs = Array.from(new Set(recommendations)).slice(0, 4);

  // --- Personalized designation rationale ---
  const designationWhy = buildDesignationWhy(designation, { stimuliCorrect, stimuliTotal, stimulusAccuracy, threatsCaughtPct, falseAccusationRate, threatsTotal });

  const summary = `You correctly classified ${stimuliCorrect} of ${stimuliTotal} stimuli (${stimulusAccuracy}%), catching ${threatsCaught} of ${threatsTotal} malicious cue${threatsTotal === 1 ? '' : 's'} while keeping false accusations at ${falseAccusationRate}%. ${designation.blurb}`;

  // --- Readiness ---
  const readinessLevel = deriveReadiness(compositeScore, stimulusAccuracy, falseAccusationRate);
  const readinessSummary = buildReadiness(readinessLevel, weakest?.category, threatsCaughtPct);

  // --- Radar interpretation ---
  const radarInterpretation = buildRadarInterpretation(strongest, weakest, threatsCaughtPct, safeCorrectPct);

  // --- Level interpretation (consistency + trend) ---
  const levelInterpretation = buildLevelInterpretation(tierStats);

  return {
    compositeScore, designation, designationWhy, summary,
    strengths: strengths.slice(0, 4), weaknesses: weaknesses.slice(0, 4),
    recommendations: uniqueRecs, readinessSummary, readinessLevel,
    stimuliTotal, stimuliCorrect, stimulusAccuracy,
    threatsTotal, threatsCaught, threatsCaughtPct,
    safeTotal, safeCorrect, safeCorrectPct,
    falseAccusations, falseAccusationRate,
    radarData, categoryStats, strongestCategory: strongest?.category, weakestCategory: weakest?.category,
    radarInterpretation, levelData, tierStats, levelInterpretation,
    basePointsPerCorrect: CORRECT_STIMULUS_POINTS,
  };
}

function buildDesignationWhy(
  d: DesignationInfo,
  s: { stimuliCorrect: number; stimuliTotal: number; stimulusAccuracy: number; threatsCaughtPct: number; falseAccusationRate: number; threatsTotal: number }
): string {
  const base = `Awarded for ${s.stimuliCorrect}/${s.stimuliTotal} stimuli read correctly (${s.stimulusAccuracy}%), ${s.threatsCaughtPct}% of threats neutralised and a ${s.falseAccusationRate}% false-alarm rate.`;
  switch (d.tier) {
    case 1: return `${base} That combination of precision and recall places you in the top tier of investigators.`;
    case 2: return `${base} Consistently sharp detection with few mistakes — just shy of the top rank.`;
    case 3: return `${base} Dependable judgement overall, with room to tighten the edges.`;
    case 4: return `${base} You're spotting many threats, but a few key cues are still getting past you.`;
    default: return `${base} This rank reflects an early stage — every expert started here. Focus on the basics below.`;
  }
}

function deriveReadiness(score: number, acc: number, falseRate: number): PerformanceAnalysis['readinessLevel'] {
  if (score > 200 && acc >= 85 && falseRate <= 10) return 'ELITE';
  if (score > 150 && acc >= 65) return 'HIGH';
  if (score > 80) return 'MODERATE';
  return 'LOW';
}

function buildReadiness(level: PerformanceAnalysis['readinessLevel'], weakestCat: string | undefined, threatsCaughtPct: number): string {
  const focus = weakestCat ? `; keep an eye on ${weakestCat.toLowerCase()}` : '';
  const map: Record<PerformanceAnalysis['readinessLevel'], string> = {
    ELITE: `Phishing readiness: ELITE. You'd catch almost any real-world scam thrown at you.`,
    HIGH: `Phishing readiness: HIGH — you caught ${threatsCaughtPct}% of threats${focus}. A little more caution and you're elite.`,
    MODERATE: `Phishing readiness: MODERATE. You'd spot the obvious scams, but convincing ones may still fool you${focus}.`,
    LOW: `Phishing readiness: LOW. Treat unexpected messages with suspicion and verify before acting${focus}.`,
  };
  return map[level];
}

function buildRadarInterpretation(
  strongest: CategoryStat | undefined,
  weakest: CategoryStat | undefined,
  threatsCaughtPct: number,
  safeCorrectPct: number
): string {
  if (!strongest && !weakest) {
    return `This radar maps your detection accuracy across attack vectors. Not enough data yet to rank your vectors — play a full run for a detailed breakdown.`;
  }
  const parts: string[] = [`This radar maps your detection accuracy across attack vectors.`];
  if (strongest) parts.push(`Strongest: ${strongest.category.toLowerCase()} at ${strongest.accuracy}%.`);
  if (weakest && weakest.category !== strongest?.category) parts.push(`Needs the most work: ${weakest.category.toLowerCase()} at ${weakest.accuracy}%.`);
  if (threatsCaughtPct >= safeCorrectPct) parts.push(`You're better at spotting threats than verifying safe content — trust legitimate messages a little more.`);
  else parts.push(`You verify safe content well but miss more threats — sharpen your eye for malicious cues.`);
  return parts.join(' ');
}

function buildLevelInterpretation(tierStats: TierStat[]): string {
  const reached = tierStats.filter(t => t.reached);
  if (reached.length === 0) return `This chart tracks your accuracy across the five difficulty levels. No level data yet.`;
  const accs = reached.map(t => t.accuracy);
  const spread = Math.max(...accs) - Math.min(...accs);
  const consistent = spread <= 20;
  const early = reached.filter(t => t.level <= 2).map(t => t.accuracy);
  const late = reached.filter(t => t.level >= 4).map(t => t.accuracy);
  const earlyAvg = early.length ? Math.round(early.reduce((a, b) => a + b, 0) / early.length) : null;
  const lateAvg = late.length ? Math.round(late.reduce((a, b) => a + b, 0) / late.length) : null;

  const parts: string[] = [`This chart tracks your accuracy across the five difficulty levels.`];
  parts.push(`Your performance was ${consistent ? 'consistent' : 'inconsistent'} (a ${spread}-point spread).`);
  if (earlyAvg !== null && lateAvg !== null) {
    if (lateAvg > earlyAvg + 10) parts.push(`You improved as the game went on — ${lateAvg}% on the harder levels vs ${earlyAvg}% on the easier ones.`);
    else if (lateAvg < earlyAvg - 10) parts.push(`You declined on the harder levels — ${lateAvg}% late vs ${earlyAvg}% early; tougher cues caught you out.`);
    else parts.push(`You held steady as difficulty rose (${earlyAvg}% early → ${lateAvg}% late).`);
  }
  return parts.join(' ');
}

// Used by the share image renderer (keeps ResultsScreen decoupled from scoring internals).
export { CORRECT_STIMULUS_POINTS };
