import { afterEach, describe, expect, it } from 'vitest';
import Problem from '../models/problemModel.js';
import TestCase from '../models/testCaseModel.js';
import User from '../models/userModel.js';
import { seed } from '../seed.js';

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
		expect(await TestCase.countDocuments()).toBe(15);
		expect(await TestCase.countDocuments({ isSample: true })).toBe(3);
		expect((await User.findOne({ email: 'admin@test.com' })).role).toBe('admin');
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
