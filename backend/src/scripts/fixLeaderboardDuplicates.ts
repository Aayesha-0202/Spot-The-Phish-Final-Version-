/**
 * One-time migration script for the leaderboard duplicate-entry bug fix.
 *
 * What this does:
 *   1. Drops the old broken partial index on leaderboardentries.playerId
 *      (was: { user: { $exists: false } } — did NOT match docs with user: null)
 *   2. Removes any duplicate leaderboard entries, keeping the most recent one
 *      per player (authenticated: keyed by user; guest: keyed by playerId)
 *   3. Mongoose will automatically recreate the corrected index (using { user: null })
 *      the next time the server starts.
 *
 * Run once with:
 *   npx tsx src/scripts/fixLeaderboardDuplicates.ts
 */
import { connectDB, disconnectDB } from '../config/db';
import mongoose from 'mongoose';
import { logger } from '../utils/logger';

async function main() {
  await connectDB();
  try {
    const db = mongoose.connection.db;
    if (!db) throw new Error('No database connection');

    const collection = db.collection('leaderboardentries');

    // -----------------------------------------------------------------------
    // Step 1: Drop the old broken index (if it still exists)
    // -----------------------------------------------------------------------
    try {
      const indexes = await collection.indexes();
      logger.info('Current leaderboardentries indexes: ' + JSON.stringify(indexes.map(i => i.name)));

      // The old broken index is named "playerId_1" with partialFilterExpression $exists: false
      const oldIndex = indexes.find(
        (idx) =>
          idx.name === 'playerId_1' &&
          idx.partialFilterExpression &&
          JSON.stringify(idx.partialFilterExpression).includes('$exists')
      );
      if (oldIndex) {
        logger.info(`Dropping old broken index: ${oldIndex.name}`);
        await collection.dropIndex(oldIndex.name!);
        logger.info('Old index dropped successfully.');
      } else {
        logger.info('Old broken index not found — may have already been dropped or replaced.');
      }
    } catch (e) {
      logger.warn('Could not inspect/drop old index: ' + (e as Error).message);
    }

    // -----------------------------------------------------------------------
    // Step 2: De-duplicate guest entries (user: null, same playerId)
    // -----------------------------------------------------------------------
    logger.info('De-duplicating guest leaderboard entries...');
    const guestDups = await collection
      .aggregate([
        { $match: { user: null } },
        { $sort: { updatedAt: -1 } },
        { $group: { _id: '$playerId', ids: { $push: '$_id' }, count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
      ])
      .toArray();

    let guestDupCount = 0;
    for (const group of guestDups) {
      const idsToDelete = group.ids.slice(1); // keep the first (most recent)
      await collection.deleteMany({ _id: { $in: idsToDelete } });
      guestDupCount += idsToDelete.length;
      logger.info(`  playerId="${group._id}": removed ${idsToDelete.length} duplicate(s)`);
    }
    logger.info(`Guest de-duplication done. Removed ${guestDupCount} duplicate(s).`);

    // -----------------------------------------------------------------------
    // Step 3: De-duplicate authenticated user entries (same user ObjectId)
    // -----------------------------------------------------------------------
    logger.info('De-duplicating authenticated user leaderboard entries...');
    const authDups = await collection
      .aggregate([
        { $match: { user: { $ne: null } } },
        { $sort: { updatedAt: -1 } },
        { $group: { _id: '$user', ids: { $push: '$_id' }, count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
      ])
      .toArray();

    let authDupCount = 0;
    for (const group of authDups) {
      const idsToDelete = group.ids.slice(1);
      await collection.deleteMany({ _id: { $in: idsToDelete } });
      authDupCount += idsToDelete.length;
      logger.info(`  user="${group._id}": removed ${idsToDelete.length} duplicate(s)`);
    }
    logger.info(`Auth de-duplication done. Removed ${authDupCount} duplicate(s).`);

    // -----------------------------------------------------------------------
    // Step 4: Set gamesPlayed = 1 on all entries that are missing it
    // -----------------------------------------------------------------------
    const updateResult = await collection.updateMany(
      { gamesPlayed: { $exists: false } },
      { $set: { gamesPlayed: 1 } }
    );
    logger.info(`Set gamesPlayed = 1 on ${updateResult.modifiedCount} existing entries.`);

    logger.info('✅ Migration complete. Restart the server to recreate the fixed index.');
  } finally {
    await disconnectDB();
  }
}

main().catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});
