import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../app.js';
import Submission from '../models/submissionModel.js';
import User from '../models/userModel.js';
import { redis } from '../services/redis.js';
import { purgeDeactivatedAccounts } from '../services/accountCleanup.js';
import { PASSWORD, createProblem, createUser } from './helpers.js';

const DAY = 24 * 60 * 60 * 1000;

describe('deleting your account', () => {
	it('needs the password', async () => {
		const { agent, user } = await createUser();
		const res = await agent.delete('/api/v1/users/me').send({ password: 'wrong-password' });
		expect(res.status).toBe(401);
		expect((await User.findById(user._id)).deactivatedAt).toBeUndefined();
	});

	it('deactivates the account and logs it out', async () => {
		const { agent, user, token } = await createUser();
		const res = await agent.delete('/api/v1/users/me').send({ password: PASSWORD });

		expect(res.status).toBe(200);
		expect((await User.findById(user._id)).deactivatedAt).toBeInstanceOf(Date);
		const me = await request(app).get('/api/v1/users/me').set('Authorization', `Bearer ${token}`);
		expect(me.status).toBe(401);
	});

	it('is cancelled by logging in again', async () => {
		const { agent, user, email } = await createUser();
		await agent.delete('/api/v1/users/me').send({ password: PASSWORD });

		const login = await request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD });
		expect(login.status).toBe(200);
		expect((await User.findById(user._id)).deactivatedAt).toBeUndefined();
	});
});

describe('purging deactivated accounts', () => {
	const deactivate = async (daysAgo) => {
		const { user } = await createUser();
		await User.updateOne({ _id: user._id }, { deactivatedAt: new Date(Date.now() - daysAgo * DAY) });
		return user;
	};

	it('deletes accounts past the 30 days, with their submissions and standings', async () => {
		const problem = await createProblem();
		const contestId = '6a0000000000000000000001';
		const old = await deactivate(31);
		await Submission.create({ userId: old._id, problemId: problem._id, contestId, language: 'python3', sourceCode: 'print(1)' });

		expect(await purgeDeactivatedAccounts()).toBe(1);
		expect(await User.findById(old._id)).toBeNull();
		expect(await Submission.countDocuments()).toBe(0);
		expect(redis.zrem).toHaveBeenCalledWith(`contest:${contestId}:board`, old._id);
	});

	it('keeps accounts still inside the 30 days, and active ones', async () => {
		await deactivate(29);
		await createUser();

		expect(await purgeDeactivatedAccounts()).toBe(0);
		expect(await User.countDocuments()).toBe(2);
	});
});
