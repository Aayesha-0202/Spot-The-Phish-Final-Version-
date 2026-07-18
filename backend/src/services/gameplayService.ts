/**
 * Gameplay Service — Stimulus Rotation System
 *
 * Provides persistent, per-player stimulus selection with:
 * - Tier-by-tier seen history tracking
 * - Independent tier reset when exhausted
 * - PHISH/SAFE distribution balancing (target 8/7)
 * - Efficient set-based lookups
 */
import { PlayerStimulusHistory } from '../models/PlayerStimulusHistory';
import { GAME_STIMULI, getStimulusCategory } from '../data/stimuli';
import type { IPlayerStimulusHistory } from '../types';

const STIMULI_PER_ROUND = 3;
const TOTAL_ROUNDS = 5;
const TARGET_PHISH = 8;
const TARGET_SAFE = 7;

// Pre-compute stimulus metadata for O(1) lookups
const stimulusMeta = new Map<string, { tier: number; truthClass: 'phish' | 'legit' }>();
for (const s of GAME_STIMULI) {
  const elements = [s.sender, s.content, s.actionUrl, s.actionText, s.amount].filter(Boolean) as Array<{ isSuspicious: boolean }>;
  const hasThreat = elements.some((e) => e.isSuspicious);
  stimulusMeta.set(s.id, {
    tier: s.difficultyTier,
    truthClass: hasThreat ? 'phish' : 'legit',
  });
}

// Pre-compute tier pools for O(1) tier filtering
const tierPools: Record<number, string[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
const tierPhishPools: Record<number, string[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
const tierSafePools: Record<number, string[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };

for (const s of GAME_STIMULI) {
  const meta = stimulusMeta.get(s.id)!;
  tierPools[meta.tier].push(s.id);
  if (meta.truthClass === 'phish') {
    tierPhishPools[meta.tier].push(s.id);
  } else {
    tierSafePools[meta.tier].push(s.id);
  }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getSeenArray(history: IPlayerStimulusHistory, tier: number): string[] {
  switch (tier) {
    case 1: return history.tier1Seen;
    case 2: return history.tier2Seen;
    case 3: return history.tier3Seen;
    case 4: return history.tier4Seen;
    case 5: return history.tier5Seen;
    default: return [];
  }
}

function setSeenArray(history: IPlayerStimulusHistory, tier: number, ids: string[]): void {
  switch (tier) {
    case 1: history.tier1Seen = ids; break;
    case 2: history.tier2Seen = ids; break;
    case 3: history.tier3Seen = ids; break;
    case 4: history.tier4Seen = ids; break;
    case 5: history.tier5Seen = ids; break;
  }
}

/**
 * Get or create a player's stimulus history document.
 */
export async function getOrCreateHistory(playerId: string): Promise<IPlayerStimulusHistory> {
  let history = await PlayerStimulusHistory.findOne({ playerId });
  if (!history) {
    history = await PlayerStimulusHistory.create({
      playerId,
      tier1Seen: [],
      tier2Seen: [],
      tier3Seen: [],
      tier4Seen: [],
      tier5Seen: [],
      gamesPlayed: 0,
      totalStimuliSeen: 0,
      lastGameplayStimuli: { tier1: [], tier2: [], tier3: [], tier4: [], tier5: [] },
    });
  }
  return history;
}

/**
 * Generate a balanced gameplay session for a player.
 *
 * Returns 15 stimulus IDs (3 per tier) with target 8 PHISH / 7 SAFE distribution.
 * Each tier's seen history is reset independently when exhausted.
 */
export async function generateGameplaySession(playerId: string): Promise<{
  stimuli: string[];
  tierBreakdown: Record<number, string[]>;
  phishCount: number;
  safeCount: number;
}> {
  const history = await getOrCreateHistory(playerId);

  const tierBreakdown: Record<number, string[]> = {};
  let allSelected: string[] = [];

  // Step 1: For each tier, check exhaustion and reset if needed, then get unseen pools
  const unseenPhish: Record<number, string[]> = {};
  const unseenSafe: Record<number, string[]> = {};

  for (let tier = 1; tier <= 5; tier++) {
    const seen = new Set(getSeenArray(history, tier));
    const totalInTier = tierPools[tier].length;

    // Reset if all stimuli in this tier have been seen
    if (seen.size >= totalInTier && totalInTier > 0) {
      setSeenArray(history, tier, []);
      seen.clear();
    }

    unseenPhish[tier] = tierPhishPools[tier].filter((id) => !seen.has(id));
    unseenSafe[tier] = tierSafePools[tier].filter((id) => !seen.has(id));
  }

  // Step 2: Compute phishing count per tier using greedy allocation
  // Target: TARGET_PHISH total across 5 tiers, each tier gets 1-2 phish
  const totalPhishAvailable = Object.values(unseenPhish).reduce((sum, arr) => sum + arr.length, 0);
  const targetPhish = Math.min(TARGET_PHISH, totalPhishAvailable);

  // Each tier can contribute 0-2 phish (to maintain some safe in each tier)
  const phishPerTier: Record<number, number> = {};
  let remainingPhish = targetPhish;

  // First pass: give each tier up to 2 phish
  for (let tier = 1; tier <= 5; tier++) {
    const maxForTier = Math.min(2, unseenPhish[tier].length);
    const give = Math.min(maxForTier, remainingPhish);
    phishPerTier[tier] = give;
    remainingPhish -= give;
  }

  // Second pass: distribute any remaining phish (if some tiers couldn't take 2)
  for (let tier = 1; tier <= 5; tier++) {
    if (remainingPhish <= 0) break;
    const canTakeMore = Math.min(unseenPhish[tier].length - phishPerTier[tier], remainingPhish, 2 - phishPerTier[tier]);
    if (canTakeMore > 0) {
      phishPerTier[tier] += canTakeMore;
      remainingPhish -= canTakeMore;
    }
  }

  // Step 3: Select stimuli for each tier
  let totalPhish = 0;
  let totalSafe = 0;

  for (let tier = 1; tier <= 5; tier++) {
    const phishCount = phishPerTier[tier];
    const safeCount = STIMULI_PER_ROUND - phishCount;

    const selectedPhish = shuffle(unseenPhish[tier]).slice(0, phishCount);
    const selectedSafe = shuffle(unseenSafe[tier]).slice(0, safeCount);

    const tierStimuli = shuffle([...selectedPhish, ...selectedSafe]);
    tierBreakdown[tier] = tierStimuli;
    allSelected = allSelected.concat(tierStimuli);

    totalPhish += selectedPhish.length;
    totalSafe += selectedSafe.length;
  }

  // Step 4: Update history
  for (let tier = 1; tier <= 5; tier++) {
    const seen = getSeenArray(history, tier);
    setSeenArray(history, tier, [...seen, ...tierBreakdown[tier]]);
  }

  history.gamesPlayed += 1;
  history.totalStimuliSeen = history.tier1Seen.length + history.tier2Seen.length +
    history.tier3Seen.length + history.tier4Seen.length + history.tier5Seen.length;
  history.lastPlayedAt = new Date();
  history.lastGameplayStimuli = {
    tier1: tierBreakdown[1],
    tier2: tierBreakdown[2],
    tier3: tierBreakdown[3],
    tier4: tierBreakdown[4],
    tier5: tierBreakdown[5],
  };

  await history.save();

  return {
    stimuli: allSelected,
    tierBreakdown,
    phishCount: totalPhish,
    safeCount: totalSafe,
  };
}

/**
 * Get admin analytics for a single player.
 */
export async function getPlayerAnalytics(playerId: string) {
  const history = await getOrCreateHistory(playerId);

  const tierStats = [];
  let totalSeen = 0;
  let totalAvailable = 0;

  for (let tier = 1; tier <= 5; tier++) {
    const seen = getSeenArray(history, tier).length;
    const available = tierPools[tier].length;
    totalSeen += seen;
    totalAvailable += available;
    tierStats.push({
      tier,
      seen,
      total: available,
      remaining: Math.max(0, available - seen),
    });
  }

  return {
    playerId: history.playerId,
    gamesPlayed: history.gamesPlayed,
    totalStimuliSeen: history.totalStimuliSeen,
    totalAvailable,
    completionPercentage: totalAvailable > 0 ? Math.round((totalSeen / totalAvailable) * 100) : 0,
    lastPlayedAt: history.lastPlayedAt,
    tierStats,
  };
}

/**
 * Get admin analytics for all players.
 */
export async function getAllPlayersAnalytics() {
  const histories = await PlayerStimulusHistory.find().sort({ gamesPlayed: -1 });

  return histories.map((h) => {
    const tierStats = [];
    let totalSeen = 0;
    let totalAvailable = 0;

    for (let tier = 1; tier <= 5; tier++) {
      const seen = getSeenArray(h, tier).length;
      const available = tierPools[tier].length;
      totalSeen += seen;
      totalAvailable += available;
      tierStats.push({
        tier,
        seen,
        total: available,
        remaining: Math.max(0, available - seen),
      });
    }

    return {
      playerId: h.playerId,
      gamesPlayed: h.gamesPlayed,
      totalStimuliSeen: h.totalStimuliSeen,
      totalAvailable,
      completionPercentage: totalAvailable > 0 ? Math.round((totalSeen / totalAvailable) * 100) : 0,
      lastPlayedAt: h.lastPlayedAt,
      tierStats,
    };
  });
}
