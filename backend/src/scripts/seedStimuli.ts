/**
 * Seed the Stimuli content library into MongoDB from backend/src/data/stimuli.ts.
 *
 *   npm run seed   (runs node dist/scripts/seedStimuli.js)
 *
 * Idempotent: upserts by stimulusId. Existing exposure counts are preserved.
 */
import { connectDB, disconnectDB } from '../config/db';
import { Stimulus } from '../models/Stimulus';
import { GAME_STIMULI, STIMULUS_CATEGORIES, getStimulusCategory } from '../data/stimuli';
import { logger } from '../utils/logger';

async function main() {
  await connectDB();

  let upserted = 0;
  for (const s of GAME_STIMULI) {
    // Derive truth class + cue list from the element-level ground truth.
    const elements = [s.sender, s.content, s.actionUrl, s.actionText, s.amount].filter(Boolean) as Array<{
      text: string;
      isSuspicious: boolean;
      reason?: string;
    }>;
    const hasThreat = elements.some((e) => e.isSuspicious);
    const truthClass: 'phish' | 'legit' = hasThreat ? 'phish' : 'legit';
    const cueList = elements.filter((e) => e.isSuspicious).map((e) => e.reason || e.text.slice(0, 60));

    await Stimulus.updateOne(
      { stimulusId: s.id },
      {
        $set: {
          stimulusId: s.id,
          type: s.type,
          category: getStimulusCategory(s),
          tier: s.difficultyTier,
          truthClass,
          cueList,
          calibration: { basePoints: 10 },
          renderedAssets: {},
          language: 'en',
          status: 'active',
        },
        $setOnInsert: { exposureCount: 0 },
      },
      { upsert: true }
    );
    upserted++;
  }

  logger.info(`✅ Seeded ${upserted} stimuli (${GAME_STIMULI.length} in library; ${Object.keys(STIMULUS_CATEGORIES).length} legacy category mappings).`);
  await disconnectDB();
  process.exit(0);
}

main().catch((err) => {
  logger.error('Seed failed:', (err as Error).message);
  process.exit(1);
});
