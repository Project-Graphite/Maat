import { randomBytes } from 'node:crypto';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { applyVerdict, minutesSinceStart } from '../../src/services/leaderboard.js';
import { redis } from '../../src/services/redis.js';

// These tests run the real Lua scoring script, so they need Redis (docker compose up -d redis).
// Without it they are skipped instead of failing.
const available = await Promise.race([
	redis.ping().then(() => true),
	new Promise((resolve) => setTimeout(() => resolve(false), 2000)),
]).catch(() => false);

const id = () => randomBytes(12).toString('hex');
const SOLVED = 1_000_000;

const contests = [];
const newContest = () => {
	const contestId = id();
	contests.push(contestId);
	return contestId;
};

const submit = (contestId, userId, problemId, verdict, minutes) =>
	applyVerdict({ contestId, userId, problemId, verdict, minutes });

const board = async (contestId) => {
	const rows = await redis.zrevrange(`contest:${contestId}:board`, 0, -1, 'WITHSCORES');
	const result = [];
	for (let i = 0; i < rows.length; i += 2) result.push({ userId: rows[i], score: Number(rows[i + 1]) });
	return result;
};

const stats = async (contestId, userId) => {
	const hash = await redis.hgetall(`contest:${contestId}:u:${userId}`);
	return { solved: Number(hash.solved || 0), penalty: Number(hash.penalty || 0) };
};

afterEach(async () => {
	if (!available) return;
	for (const contestId of contests.splice(0)) {
		const keys = await redis.keys(`contest:${contestId}:*`);
		if (keys.length) await redis.del(...keys);
	}
});

afterAll(() => redis.disconnect());

describe.skipIf(!available)('contest scoring', () => {
	it('scores a solved problem by the minute it was solved', async () => {
		const contest = newContest();
		const [user, problem] = [id(), id()];

		expect(await submit(contest, user, problem, 'ACCEPTED', 30)).toBe(true);

		expect(await stats(contest, user)).toEqual({ solved: 1, penalty: 30 });
		expect(await board(contest)).toEqual([{ userId: user, score: SOLVED - 30 }]);
	});

	it('adds 20 penalty minutes for each wrong attempt before the solve', async () => {
		const contest = newContest();
		const [user, problem] = [id(), id()];

		await submit(contest, user, problem, 'WRONG_ANSWER', 3);
		await submit(contest, user, problem, 'TLE', 6);
		await submit(contest, user, problem, 'ACCEPTED', 10);

		expect(await stats(contest, user)).toEqual({ solved: 1, penalty: 10 + 2 * 20 });
	});

	it('counts every kind of failed run as a wrong attempt', async () => {
		const contest = newContest();
		const [user, problem] = [id(), id()];

		for (const verdict of ['WRONG_ANSWER', 'TLE', 'MLE', 'RUNTIME_ERROR']) {
			await submit(contest, user, problem, verdict, 1);
		}
		await submit(contest, user, problem, 'ACCEPTED', 5);

		expect(await stats(contest, user)).toEqual({ solved: 1, penalty: 5 + 4 * 20 });
	});

	it('ignores everything after the first accepted run on a problem', async () => {
		const contest = newContest();
		const [user, problem] = [id(), id()];

		await submit(contest, user, problem, 'ACCEPTED', 10);
		expect(await submit(contest, user, problem, 'ACCEPTED', 50)).toBe(false);
		expect(await submit(contest, user, problem, 'WRONG_ANSWER', 60)).toBe(false);

		expect(await stats(contest, user)).toEqual({ solved: 1, penalty: 10 });
	});

	it('does not score compile errors, system errors or unfinished runs', async () => {
		const contest = newContest();
		const [user, problem] = [id(), id()];

		for (const verdict of ['COMPILE_ERROR', 'SYSTEM_ERROR', 'PENDING', 'RUNNING']) {
			expect(await submit(contest, user, problem, verdict, 5)).toBe(false);
		}
		await submit(contest, user, problem, 'ACCEPTED', 10);

		expect(await stats(contest, user)).toEqual({ solved: 1, penalty: 10 });
		expect(await board(contest)).toHaveLength(1);
	});

	it('adds up several problems', async () => {
		const contest = newContest();
		const user = id();

		await submit(contest, user, id(), 'ACCEPTED', 10);
		await submit(contest, user, id(), 'ACCEPTED', 25);

		expect(await stats(contest, user)).toEqual({ solved: 2, penalty: 35 });
		expect(await board(contest)).toEqual([{ userId: user, score: 2 * SOLVED - 35 }]);
	});

	it('keeps each problem separate', async () => {
		const contest = newContest();
		const [user, first, second] = [id(), id(), id()];

		await submit(contest, user, first, 'WRONG_ANSWER', 5);
		await submit(contest, user, second, 'ACCEPTED', 10);

		// The wrong attempt was on another problem, so it adds no penalty here
		expect(await stats(contest, user)).toEqual({ solved: 1, penalty: 10 });
	});

	it('ranks more solved problems first, then the lower penalty', async () => {
		const contest = newContest();
		const [fast, slow, one, none] = [id(), id(), id(), id()];
		const [p1, p2] = [id(), id()];

		await submit(contest, one, p1, 'ACCEPTED', 1);
		await submit(contest, slow, p1, 'ACCEPTED', 50);
		await submit(contest, slow, p2, 'ACCEPTED', 60);
		await submit(contest, fast, p1, 'ACCEPTED', 10);
		await submit(contest, fast, p2, 'ACCEPTED', 20);
		await submit(contest, none, p1, 'WRONG_ANSWER', 5);

		const order = (await board(contest)).map((row) => row.userId);
		expect(order).toEqual([fast, slow, one, none]);
	});

	it('keeps contests apart', async () => {
		const [a, b] = [newContest(), newContest()];
		const [user, problem] = [id(), id()];

		await submit(a, user, problem, 'ACCEPTED', 10);

		expect(await board(b)).toEqual([]);
	});
});

describe('minutesSinceStart', () => {
	it('measures from the contest start', () => {
		const startsAt = new Date('2026-01-01T10:00:00Z');
		expect(minutesSinceStart({ startsAt }, new Date('2026-01-01T10:30:00Z'))).toBe(30);
		expect(minutesSinceStart({ startsAt }, new Date('2026-01-01T10:00:30Z'))).toBe(0.5);
	});
});
