import { Queue, QueueEvents } from 'bullmq';
import { createRedis } from './redis.js';

export const JUDGE_QUEUE = 'judge';

// enableOfflineQueue: false makes add() fail at once when Redis is down, so the request
// gets a 503 instead of hanging until Redis comes back
export const judgeQueue = new Queue(JUDGE_QUEUE, {
    connection: createRedis({ enableOfflineQueue: false }),
});

judgeQueue.on('error', (err) => console.log('Judge queue error:', err.message));

// Lets a request wait for a trial run to finish
export const judgeEvents = new QueueEvents(JUDGE_QUEUE, {
    connection: createRedis({ maxRetriesPerRequest: null }),
});
judgeEvents.on('error', (err) => console.log('Judge events error:', err.message));
