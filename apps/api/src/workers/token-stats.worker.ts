import { Queue, Worker } from 'bullmq';
import { tokenService } from '../services/token.service';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const connection = {
  host: REDIS_URL.includes('://') ? new URL(REDIS_URL).hostname : 'localhost',
  port: REDIS_URL.includes('://') ? parseInt(new URL(REDIS_URL).port || '6379') : 6379,
};

// Create queue for token stats updates
export const tokenStatsQueue = new Queue('token-stats-update', { connection });

// Worker to process token stats updates
export const tokenStatsWorker = new Worker(
  'token-stats-update',
  async (job) => {
    console.log(`\n[${new Date().toISOString()}] Processing token stats update job ${job.id}...`);

    try {
      await tokenService.updateAllTokenStats();

      console.log(`✅ Token stats update job ${job.id} completed`);

      return {
        success: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`❌ Token stats update failed:`, error);
      throw error;
    }
  },
  {
    connection,
    concurrency: 1, // Process one job at a time
  }
);

// Event listeners
tokenStatsWorker.on('completed', (job) => {
  console.log(`[${new Date().toISOString()}] Token stats update completed`);
});

tokenStatsWorker.on('failed', (job, err) => {
  console.error(`❌ Token stats update failed:`, err);
});

/**
 * Schedule token stats updates to run every 1 minute
 */
export async function scheduleTokenStatsUpdates() {
  // Add repeating job that runs every 1 minute
  await tokenStatsQueue.add(
    'update-all-token-stats',
    {},
    {
      repeat: {
        every: 1 * 60 * 1000, // 1 minute in milliseconds
      },
    }
  );

  console.log('✅ Token stats updates scheduled (every 1 minute)');

  // Queue an immediate update
  await tokenStatsQueue.add('update-all-token-stats', {});
  console.log('✅ Initial token stats update job queued');
}

/**
 * Shutdown worker gracefully
 */
export async function shutdownTokenStatsWorker() {
  await tokenStatsWorker.close();
  await tokenStatsQueue.close();
}
