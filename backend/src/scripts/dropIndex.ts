import { connectDB, disconnectDB } from '../config/db';
import mongoose from 'mongoose';
import { logger } from '../utils/logger';

async function main() {
  await connectDB();
  try {
    const db = mongoose.connection.db;
    if (db) {
      // Find stimulus collection
      const collection = db.collection('stimuli'); // Let's check both 'stimulus' and 'stimuli'
      let collections = await db.listCollections().toArray();
      logger.info('Collections in database: ' + collections.map(c => c.name).join(', '));

      for (const collName of ['stimulus', 'stimuli']) {
        const coll = db.collection(collName);
        try {
          const indexes = await coll.indexes();
          logger.info(`Indexes for ${collName}:`, JSON.stringify(indexes, null, 2));
          
          const slugIndex = indexes.find(idx => idx.name === 'slug_1');
          if (slugIndex) {
            logger.info(`Dropping slug_1 index on ${collName}...`);
            await coll.dropIndex('slug_1');
            logger.info(`slug_1 index dropped successfully on ${collName}.`);
          }
        } catch (e) {
          logger.info(`Could not inspect indexes for ${collName}: ${(e as Error).message}`);
        }
      }
    } else {
      logger.error('No database connection.');
    }
  } catch (err) {
    logger.error('Failed to drop index:', (err as Error).message);
  } finally {
    await disconnectDB();
  }
}

main().catch(console.error);
