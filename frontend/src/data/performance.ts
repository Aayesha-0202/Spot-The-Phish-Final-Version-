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

export function getDesignation(compositeScore: number, threatsCaughtPct: number = 0, stimulusAccuracy: number = 0): DesignationInfo {
  // Designation requires BOTH a high score AND meaningful threat detection.
  // Prevents players with 0% threat detection from earning top designations.
  if (compositeScore >= 130 && threatsCaughtPct >= 50 && stimulusAccuracy >= 60) return { label: 'NETRUNNER SUPREME', tier: 1, blurb: 'Elite threat-intel operator.' };
  if (compositeScore >= 100 && threatsCaughtPct >= 30 && stimulusAccuracy >= 50) return { label: 'ELITE HACKER', tier: 2, blurb: 'Sharp, consistent investigator.' };
  if (compositeScore >= 70 && threatsCaughtPct >= 15) return { label: 'CYBER SEC PRO', tier: 3, blurb: 'Solid, dependable judgement.' };
  if (compositeScore >= 40) return { label: 'VIGILANT NODE', tier: 4, blurb: 'Getting there — keep training.' };
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
  // NEW: Enhanced metrics
  attentionToDetail: number; // 0-100
  accuracy: number;          // 0-100
  efficiency: number;        // 0-100
  completionTimeMs: number;
  completionTimeFormatted: string;
  correctClassifications: number;
  incorrectClassifications: number;
  threatDetectionRate: number;  // % of phishing stimuli correctly handled
  safeDetectionRate: number;    // % of safe stimuli correctly handled
  pressureAnalysis: string;
  performsUnderPressure: boolean;
  softSkills: string[];
}

function pct(n: number, d: number): number {
  return d > 0 ? Math.round((n / d) * 100) : 0;
}

function formatTime(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}m ${sec.toString().padStart(2, '0')}s`;
}

export function analyzePerformance(history: GameHistoryEntry[], completionTimeMs: number, finalScore?: number): PerformanceAnalysis {
  const compositeScore = finalScore ?? computeTotalScore(history);

  // Per-element tally across the whole run.
  const axisTotals: Record<string, { correct: number; total: number }> = {};
  RADAR_AXES.forEach(a => (axisTotals[a] = { correct: 0, total: 0 }));

  const tierMap: Record<number, { correct: number; total: number }> = { 1: { correct: 0, total: 0 }, 2: { correct: 0, total: 0 }, 3: { correct: 0, total: 0 }, 4: { correct: 0, total: 0 }, 5: { correct: 0, total: 0 } };

  let threatsTotal = 0, threatsCaught = 0;
  let safeTotal = 0, safeCorrect = 0, falseAccusations = 0;
  let totalElements = 0;
  let correctElementClassifications = 0;
  let incorrectElementClassifications = 0;
  let totalSuspiciousElements = 0;
  let suspiciousElementsFound = 0;
  let ignoredSuspicious = 0;

  // Per-round accuracy for pressure analysis
  const roundAccuracies: Record<number, { correct: number; total: number }> = {};

  // Phish vs safe stimulus counts
  let phishStimuliTotal = 0, phishStimuliCorrect = 0;
  let safeStimuliTotal = 0, safeStimuliCorrect = 0;

  history.forEach(h => {
    const stimulus = GAME_STIMULI.find(s => s.id === h.stimulusId);
    if (!stimulus) return;

    if (tierMap[stimulus.difficultyTier]) {
      tierMap[stimulus.difficultyTier].total++;
      if (h.isCorrect) tierMap[stimulus.difficultyTier].correct++;
    }

    // Track round accuracy for pressure analysis
    const round = h.roundNumber || stimulus.difficultyTier;
    if (!roundAccuracies[round]) roundAccuracies[round] = { correct: 0, total: 0 };
    roundAccuracies[round].total++;
    if (h.isCorrect) roundAccuracies[round].correct++;

    // Is this a phishing or safe stimulus?
    const hasSuspiciousElement = ELEMENT_IDS.some(id => {
      const el = (stimulus as unknown as Record<string, ElementData | undefined>)[id];
      return el?.isSuspicious;
    });
    if (hasSuspiciousElement) {
      phishStimuliTotal++;
      if (h.isCorrect) phishStimuliCorrect++;
    } else {
      safeStimuliTotal++;
      if (h.isCorrect) safeStimuliCorrect++;
    }

    ELEMENT_IDS.forEach(id => {
      const el = (stimulus as unknown) as Record<string, ElementData | undefined>;
      const trueEl = el[id];
      if (!trueEl) return;
      const inv = h.investigations[id];
      const status = inv?.status;
      totalElements++;

      if (trueEl.isSuspicious) {
        const axis = reasonToAxis(trueEl.reason);
        axisTotals[axis].total++;
        threatsTotal++;
        totalSuspiciousElements++;
        if (status === 'SUSPICIOUS') {
          axisTotals[axis].correct++;
          threatsCaught++;
          suspiciousElementsFound++;
          correctElementClassifications++;
        } else {
          if (!status || status === 'SAFE') ignoredSuspicious++;
          incorrectElementClassifications++;
        }
      } else {
        axisTotals['Safe Verification'].total++;
        safeTotal++;
        if (status === 'SUSPICIOUS') {
          falseAccusations++;
          incorrectElementClassifications++;
        } else {
          safeCorrect++;
          correctElementClassifications++;
        }
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

  const designation = getDesignation(compositeScore, threatsCaughtPct, stimulusAccuracy);

  // --- NEW METRICS ---

  // Attention to Detail: ratio of suspicious elements found vs total suspicious elements
  const attentionToDetail = totalSuspiciousElements > 0
    ? Math.round((suspiciousElementsFound / totalSuspiciousElements) * 100)
    : 100;

  // Accuracy: element-level correct classifications / total element opportunities
  const accuracy = totalElements > 0
    ? Math.round((correctElementClassifications / totalElements) * 100)
    : 0;

  // Efficiency: weighted combination of accuracy and speed
  // Target ~5 minutes (300,000ms). Faster = higher efficiency.
  const speedFactor = Math.max(0, 1 - Math.min(completionTimeMs / 600000, 1)); // 0-1 scale, 10min = 0
  const efficiency = Math.round(0.6 * accuracy + 0.4 * speedFactor * 100);

  const completionTimeFormatted = formatTime(completionTimeMs);

  // Threat & Safe detection rates (stimulus-level)
  const threatDetectionRate = pct(phishStimuliCorrect, phishStimuliTotal);
  const safeDetectionRate = pct(safeStimuliCorrect, safeStimuliTotal);

  // --- PRESSURE ANALYSIS ---
  const earlyRounds = [1, 2].filter(r => roundAccuracies[r]);
  const lateRounds = [4, 5].filter(r => roundAccuracies[r]);
  const earlyAcc = earlyRounds.length > 0
    ? Math.round(earlyRounds.reduce((s, r) => s + pct(roundAccuracies[r].correct, roundAccuracies[r].total), 0) / earlyRounds.length)
    : null;
  const lateAcc = lateRounds.length > 0
    ? Math.round(lateRounds.reduce((s, r) => s + pct(roundAccuracies[r].correct, roundAccuracies[r].total), 0) / lateRounds.length)
    : null;
  const tookTooLong = completionTimeMs > 600000; // > 10 min
  const accDroppedLate = earlyAcc !== null && lateAcc !== null && (earlyAcc - lateAcc) > 15;

  let performsUnderPressure = true;
  let pressureAnalysis: string;
  if (tookTooLong && accDroppedLate) {
    performsUnderPressure = false;
    pressureAnalysis = `Your accuracy dropped from ${earlyAcc}% in early rounds to ${lateAcc}% in later rounds, and you took ${completionTimeFormatted} — longer than the expected ~5 minutes. This pattern suggests difficulty maintaining focus under sustained pressure. Practice with timed scenarios to build stamina.`;
  } else if (accDroppedLate) {
    performsUnderPressure = false;
    pressureAnalysis = `You started strong (${earlyAcc}% early) but accuracy fell to ${lateAcc}% in the harder rounds. The increasing difficulty appeared to affect your judgement. Focus on maintaining composure as complexity rises.`;
  } else if (tookTooLong) {
    pressureAnalysis = `You took ${completionTimeFormatted} — more than expected, but maintained consistent accuracy throughout. You're thorough and methodical, though faster decision-making would improve your efficiency score.`;
  } else if (earlyAcc !== null && lateAcc !== null && lateAcc >= earlyAcc) {
    pressureAnalysis = `Excellent performance under pressure — your accuracy improved from ${earlyAcc}% to ${lateAcc}% as difficulty increased, completing in ${completionTimeFormatted}. You thrive when the stakes are high.`;
  } else {
    pressureAnalysis = `You maintained consistent performance throughout the assessment (${completionTimeFormatted}). Your decision-making held steady across all difficulty levels — a sign of reliable composure under pressure.`;
  }

  // --- SOFT SKILLS ---
  const softSkills: string[] = [];
  if (attentionToDetail >= 85) softSkills.push('High Attention to Detail');
  else if (attentionToDetail < 50) softSkills.push('Needs Better Observation');

  if (accuracy >= 85) softSkills.push('Good Analytical Thinking');
  else if (accuracy < 50) softSkills.push('Needs Better Accuracy');

  if (threatDetectionRate >= 75) softSkills.push('Strong Threat Recognition');
  if (safeDetectionRate >= 75 && falseAccusationRate <= 15) softSkills.push('Good Judgment Under Uncertainty');

  // Consistency (spread of round accuracies)
  const roundAccValues = Object.values(roundAccuracies).map(r => pct(r.correct, r.total));
  const spread = roundAccValues.length > 1 ? Math.max(...roundAccValues) - Math.min(...roundAccValues) : 0;
  if (spread <= 20 && roundAccValues.length >= 3) softSkills.push('Consistent Decision Making');

  if (performsUnderPressure && lateAcc !== null && lateAcc >= 60) softSkills.push('Works Well Under Pressure');
  if (!performsUnderPressure) softSkills.push('Decision Making Under Pressure Needs Work');

  if (efficiency >= 75) softSkills.push('Efficient & Decisive');
  if (falseAccusationRate <= 10 && safeTotal > 0) softSkills.push('Low False Alarm Rate');

  // Ensure at least one skill is shown
  if (softSkills.length === 0) softSkills.push('Developing Cyber Awareness');

  // --- Strengths ---
  const strengths: string[] = [];
  if (stimulusAccuracy >= 70) strengths.push(`Strong overall verdict accuracy — ${stimuliCorrect} of ${stimuliTotal} stimuli read correctly (${stimulusAccuracy}%).`);
  if (threatsCaughtPct >= 75 && threatsTotal > 0) strengths.push(`Reliably spotted malicious cues, catching ${threatsCaught} of ${threatsTotal} threats (${threatsCaughtPct}%).`);
  if (strongest && strongest.accuracy >= 75) strengths.push(`Best detection area: ${strongest.category.toLowerCase()} (${strongest.accuracy}% accuracy).`);
  if (safeCorrectPct >= 75 && safeTotal > 0) strengths.push(`Good at verifying legitimate messages — ${safeCorrectPct}% correctly cleared as safe.`);
  if (falseAccusationRate <= 10 && safeTotal > 0) strengths.push(`Disciplined judgement: only ${falseAccusations} false accusation${falseAccusations === 1 ? '' : 's'} across ${safeTotal} safe elements.`);
  if (attentionToDetail >= 80) strengths.push(`Excellent attention to detail — identified ${attentionToDetail}% of all suspicious indicators.`);
  if (strengths.length === 0) strengths.push('You engaged with every case — that willingness to investigate is the right instinct to build on.');

  // --- Weaknesses ---
  const weaknesses: string[] = [];
  if (stimulusAccuracy < 50 && stimuliTotal > 0) weaknesses.push(`Overall verdict accuracy was low (${stimulusAccuracy}%) — several scams slipped through.`);
  if (threatsCaughtPct < 60 && threatsTotal > 0) weaknesses.push(`Missed a notable share of threats — ${threatsTotal - threatsCaught} of ${threatsTotal} malicious cues went unflagged.`);
  if (weakest && weakest.accuracy < 60 && seenAxes.length > 1) weaknesses.push(`Weakest detection area: ${weakest.category.toLowerCase()} (${weakest.accuracy}% accuracy).`);
  if (falseAccusationRate > 25 && safeTotal > 0) weaknesses.push(`Tendency to over-flag — ${falseAccusations} safe element${falseAccusations === 1 ? '' : 's'} wrongly marked as threats (${falseAccusationRate}%).`);
  if (attentionToDetail < 50 && totalSuspiciousElements > 0) weaknesses.push(`Low attention to detail — only ${attentionToDetail}% of suspicious indicators were identified. Many threats were overlooked.`);
  if (weaknesses.length === 0) weaknesses.push(`No single weak spot stood out — aim to push your strongest areas even higher.`);

  // --- Recommendations ---
  const recommendations: string[] = [];
  if (weakest && seenAxes.length > 0) recommendations.push(`Brush up on ${weakest.category.toLowerCase()} indicators — re-read the case explanations for the ones you missed.`);
  if (threatsCaughtPct < 75 && threatsTotal > 0) recommendations.push(`Slow down on urgent payment, KYC and delivery messages; verify the sender/domain before trusting urgency.`);
  if (falseAccusationRate > 20) recommendations.push(`Before flagging, confirm the sender domain and link destination — over-flagging wastes trust.`);
  if (stimulusAccuracy < 70) recommendations.push(`Replay a level to pattern-match against common phish structures (lookalike domains, masked shortcodes).`);
  recommendations.push(`Keep your "trust but verify" habit: hover links, check sender handles, and never share OTPs.`);
  // de-dup + cap
  const uniqueRecs = Array.from(new Set(recommendations)).slice(0, 4);

  // --- Personalized designation rationale ---
  const designationWhy = buildDesignationWhy(designation, { stimuliCorrect, stimuliTotal, stimulusAccuracy, threatsCaughtPct, falseAccusationRate, threatsTotal });

  const summary = `You correctly classified ${stimuliCorrect} of ${stimuliTotal} stimuli (${stimulusAccuracy}%), catching ${threatsCaught} of ${threatsTotal} malicious cue${threatsTotal === 1 ? '' : 's'} while keeping false accusations at ${falseAccusationRate}%. Completed in ${completionTimeFormatted}. ${designation.blurb}`;

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
    // NEW enhanced metrics
    attentionToDetail,
    accuracy,
    efficiency,
    completionTimeMs,
    completionTimeFormatted,
    correctClassifications: correctElementClassifications,
    incorrectClassifications: incorrectElementClassifications,
    threatDetectionRate,
    safeDetectionRate,
    pressureAnalysis,
    performsUnderPressure,
    softSkills,
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
  if (score >= 120 && acc >= 85 && falseRate <= 10) return 'ELITE';
  if (score >= 90 && acc >= 65) return 'HIGH';
  if (score >= 50) return 'MODERATE';
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
