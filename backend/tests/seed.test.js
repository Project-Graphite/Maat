import { afterEach, describe, expect, it } from 'vitest';
import Contest from '../models/contestModel.js';
import Problem from '../models/problemModel.js';
import TestCase from '../models/testCaseModel.js';
import User from '../models/userModel.js';
import { seed } from '../scripts/seed.js';

describe('seed', () => {
	afterEach(() => {
		delete process.env.SEED_ADMIN_EMAIL;
		delete process.env.SEED_ADMIN_PASSWORD;
	});

	it('creates the problems and the admin, and can run again without duplicates', async () => {
		process.env.SEED_ADMIN_EMAIL = 'admin@test.com';
		process.env.SEED_ADMIN_PASSWORD = 'password123';

		await seed();
		await seed();

		expect(await Problem.countDocuments({ visible: true })).toBe(3);
		expect(await TestCase.countDocuments()).toBe(45);
		expect(await TestCase.countDocuments({ isSample: true })).toBe(9);
		expect((await User.findOne({ email: 'admin@test.com' })).role).toBe('superadmin');
	});

	it('makes one unscheduled contest with 2 easy, 2 medium and 2 hard hidden problems', async () => {
		await seed();
		await seed();

		const contests = await Contest.find().populate('problems.problemId');
		expect(contests).toHaveLength(1);
		expect(contests[0].startsAt).toBeFalsy();
		const problems = contests[0].problems.map((p) => p.problemId);
		expect(problems.map((p) => p.difficulty).sort()).toEqual(['easy', 'easy', 'hard', 'hard', 'medium', 'medium']);
		expect(problems.every((p) => !p.visible)).toBe(true);
	});

	it('computes the contest answers', async () => {
		await seed();
		const answers = async (slug) => {
			const problem = await Problem.findOne({ slug });
			const tests = await TestCase.find({ problemId: problem._id }).select('+expectedOutput').sort('ordinal');
			return tests.map((t) => t.expectedOutput.trim());
		};

		expect((await answers('reverse-the-word'))[0]).toBe('dimaryp');
		expect((await answers('count-the-vowels')).slice(0, 3)).toEqual(['3', '0', '5']);
		expect(await answers('balanced-brackets')).toEqual(['YES', 'NO', 'NO', 'YES', 'NO']);
		expect((await answers('best-stretch')).slice(0, 3)).toEqual(['8', '-7', '-1']);
		expect((await answers('rising-sequence')).slice(0, 3)).toEqual(['4', '1', '4']);
		// 100,000 values in falling order: every pair is out of order
		expect(await answers('out-of-order')).toEqual(['2', '0', '2', expect.any(String), '4999950000']);
	});

	it('computes the expected outputs', async () => {
		await seed();
		const primes = await Problem.findOne({ slug: 'count-the-primes' });
		const tests = await TestCase.find({ problemId: primes._id }).select('+input +expectedOutput').sort('ordinal');

		// There are 4 primes up to 10 and 664,579 up to ten million
		expect(tests[0].expectedOutput).toBe('4\n');
		expect(tests[4].expectedOutput).toBe('664579\n');
	});

	it('makes no admin without credentials', async () => {
		await seed();
		expect(await User.countDocuments()).toBe(0);
	});
});

describe('load test users', () => {
	afterEach(() => {
		delete process.env.SEED_LOAD_USERS;
		delete process.env.LOAD_TEST_PASSWORD;
	});

	it('are made only when asked for, and only once', async () => {
		process.env.SEED_LOAD_USERS = '3';
		process.env.LOAD_TEST_PASSWORD = 'load-password-1';
		await seed();
		await seed();
		expect(await User.countDocuments({ email: /^loadtest-\d+@maat\.local$/ })).toBe(3);
	});

	it('need a password', async () => {
		process.env.SEED_LOAD_USERS = '3';
		await expect(seed()).rejects.toThrow(/LOAD_TEST_PASSWORD/);
	});
});
