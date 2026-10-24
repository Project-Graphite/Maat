import 'dotenv/config';
import mongoose from 'mongoose';
import { Worker } from 'bullmq';

process.on('unhandledRejection', (err) => {
	console.log('UNHANDLED REJECTION! Shutting down...');
	console.log(err.name, err.message);
	process.exit(1);
});

process.on('uncaughtException', (err) => {
	console.log('UNCAUGHT EXCEPTION! Shutting down...');
	console.log(err.name, err.message);
	process.exit(1);
});

import { failSubmission, judgeSubmission } from './judge.js';
import { measureBaseline, removeStaleSandboxes } from './sandbox.js';
import { createRedis } from './services/redis.js';

const JUDGE_QUEUE = 'judge';

await mongoose.connect(process.env.DATABASE_LOCAL);
console.log('DB connection successful!');

const removed = await removeStaleSandboxes();
if (removed) console.log(`Removed ${removed} leftover sandbox container(s)`);

const baseline = await measureBaseline();
console.log(`Sandbox startup overhead: ${baseline}ms`);

const concurrency = Number(process.env.WORKER_CONCURRENCY) || 2;

const worker = new Worker(JUDGE_QUEUE, (job) => judgeSubmission(job.data.submissionId), {
	connection: createRedis({ maxRetriesPerRequest: null }),
	concurrency,
});

worker.on('completed', (job) => console.log(`Judged submission ${job.data.submissionId}`));
worker.on('failed', async (job, err) => {
	if (!job) return;
	console.log(`Judging ${job.data.submissionId} failed (attempt ${job.attemptsMade}):`, err.message);

	try {
		if ((await job.getState()) === 'failed') await failSubmission(job.data.submissionId);
	} catch (error) {
		console.log('Could not mark the submission as failed:', error.message);
	}
});
worker.on('error', (err) => console.log('Worker error:', err.message));

console.log(`Worker is judging up to ${concurrency} submissions at once`);

const shutdown = async () => {
	await worker.close();
	await mongoose.disconnect();
	process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);