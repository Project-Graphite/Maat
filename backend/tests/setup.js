import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';

// The API tests run without Redis: fake the connection and the judge queue
vi.mock('../services/redis.js', () => ({
	redis: { status: 'ready', del: vi.fn(), zrem: vi.fn() },
	createRedis: vi.fn(() => ({ on: vi.fn() })),
}));
vi.mock('../services/queue.js', () => ({
	JUDGE_QUEUE: 'judge',
	judgeQueue: { add: vi.fn().mockResolvedValue({}), getWorkersCount: vi.fn().mockResolvedValue(1) },
}));

let mongod;

beforeAll(async () => {
	mongod = await MongoMemoryServer.create();
	await mongoose.connect(mongod.getUri());
	// Load every model, then build the unique indexes the tests rely on
	await import('../app.js');
	await mongoose.syncIndexes();
});

afterEach(async () => {
	vi.clearAllMocks();
	await Promise.all(
		Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({})),
	);
});

afterAll(async () => {
	await mongoose.disconnect();
	await mongod.stop();
});
