import { Queue, Worker } from 'bullmq';
import { tradingService } from '../services/trading.service';
import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Create Redis connection for BullMQ
const connection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

// Create queue for trade indexing jobs
export const tradeIndexQueue = new Queue('trade-indexing', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      count: 100, // Keep last 100 completed jobs
    },
    removeOnFail: {
      count: 500, // Keep last 500 failed jobs
    },
  },
});

// Create worker to process trade indexing jobs
export const tradeIndexWorker = new Worker(
  'trade-indexing',
  async (job) => {
    console.log(`\n[${new Date().toISOString()}] Processing trade indexing job ${job.id}...`);

    try {
      const result = await tradingService.indexAllAgentTrades();

      console.log(`[${new Date().toISOString()}] Trade indexing completed:`, result);

      return result;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Trade indexing failed:`, error);
      throw error;
    }
  },
  {
    connection,
    concurrency: 1, // Process one job at a time
  }
);

// Worker event handlers
tradeIndexWorker.on('completed', (job, result) => {
  console.log(`✅ Trade indexing job ${job.id} completed:`, result);
});

tradeIndexWorker.on('failed', (job, error) => {
  console.error(`❌ Trade indexing job ${job?.id} failed:`, error);
});

tradeIndexWorker.on('error', (error) => {
  console.error('Trade indexing worker error:', error);
});

/**
 * Schedule recurring trade indexing job (every 5 minutes)
 */
export async function scheduleTradeIndexing() {
  try {
    // Remove any existing repeatable jobs
    const repeatableJobs = await tradeIndexQueue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      await tradeIndexQueue.removeRepeatableByKey(job.key);
    }

    // Add new repeatable job (every 5 minutes)
    await tradeIndexQueue.add(
      'index-all-trades',
      {},
      {
        repeat: {
          every: 5 * 60 * 1000, // 5 minutes in milliseconds
        },
      }
    );

    console.log('✅ Trade indexing scheduled (every 5 minutes)');

    // Also run immediately on startup
    await tradeIndexQueue.add('index-all-trades', {});
    console.log('✅ Initial trade indexing job queued');
  } catch (error) {
    console.error('Failed to schedule trade indexing:', error);
    throw error;
  }
}

/**
 * Graceful shutdown
 */
export async function shutdownIndexer() {
  console.log('Shutting down trade indexer...');
  await tradeIndexWorker.close();
  await tradeIndexQueue.close();
  await connection.quit();
  console.log('Trade indexer shut down');
}
