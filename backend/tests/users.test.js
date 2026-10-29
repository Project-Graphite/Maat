import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../app.js';
import Submission from '../models/submissionModel.js';
import User from '../models/userModel.js';
import { createAdmin, createProblem, createUser } from './helpers.js';

describe('profile', () => {
	it('lets a user change their name', async () => {
		const { agent } = await createUser();
		const res = await agent.patch('/api/v1/users/me').send({ name: 'New Name' });
		expect(res.status).toBe(200);
		expect(res.body.data.user.name).toBe('New Name');
	});

	it('does not let a user promote themselves', async () => {
		const { agent } = await createUser();
		const res = await agent.patch('/api/v1/users/me').send({ name: 'Sneaky', role: 'admin' });
		expect(res.body.data.user.role).toBe('user');
	});
});

describe('admin user management', () => {
	it('keeps the user list and role changes away from normal users', async () => {
		const { agent, user } = await createUser();
		expect((await agent.get('/api/v1/users')).status).toBe(403);
		const res = await agent.patch(`/api/v1/users/${user._id}/role`).send({ role: 'admin' });
		expect(res.status).toBe(403);
	});

	it('lets an admin list users but not make anyone an admin', async () => {
		const { agent } = await createAdmin();
		const { user } = await createUser();

		expect((await agent.get('/api/v1/users')).status).toBe(200);
		const res = await agent.patch(`/api/v1/users/${user._id}/role`).send({ role: 'admin' });
		expect(res.status).toBe(403);
		expect((await User.findById(user._id)).role).toBe('user');
	});

	it('lets the super admin make a user an admin', async () => {
		const { agent } = await createUser({ role: 'superadmin' });
		const { user } = await createUser();

		const res = await agent.patch(`/api/v1/users/${user._id}/role`).send({ role: 'admin' });
		expect(res.status).toBe(200);
		expect(res.body.data.user.role).toBe('admin');
	});

	it('does not let the super admin change their own role', async () => {
		const { agent, user } = await createUser({ role: 'superadmin' });
		const res = await agent.patch(`/api/v1/users/${user._id}/role`).send({ role: 'user' });
		expect(res.status).toBe(400);
	});

	it('rejects an unknown role', async () => {
		const { agent } = await createUser({ role: 'superadmin' });
		const { user } = await createUser();
		const res = await agent.patch(`/api/v1/users/${user._id}/role`).send({ role: 'superuser' });
		expect(res.status).toBe(400);
	});
});

describe('admins and the super admin', () => {
	const createSuperAdmin = () => createUser({ role: 'superadmin' });

	it('let an admin delete a regular user and everything they sent', async () => {
		const { agent } = await createAdmin();
		const { user } = await createUser();
		const problem = await createProblem();
		await Submission.create({ userId: user._id, problemId: problem._id, language: 'python3', sourceCode: 'x' });

		const res = await agent.delete(`/api/v1/users/${user._id}`);

		expect(res.status).toBe(204);
		expect(await User.exists({ _id: user._id })).toBeNull();
		expect(await Submission.countDocuments()).toBe(0);
	});

	it('stop an admin from deleting or demoting another admin', async () => {
		const { agent } = await createAdmin();
		const { user: other } = await createAdmin();

		expect((await agent.delete(`/api/v1/users/${other._id}`)).status).toBe(403);
		expect((await agent.patch(`/api/v1/users/${other._id}/role`).send({ role: 'user' })).status).toBe(403);
		expect((await User.findById(other._id)).role).toBe('admin');
	});

	it('let the super admin demote and delete admins', async () => {
		const { agent } = await createSuperAdmin();
		const { user: first } = await createAdmin();
		const { user: second } = await createAdmin();

		const demoted = await agent.patch(`/api/v1/users/${first._id}/role`).send({ role: 'user' });
		expect(demoted.status).toBe(200);
		expect((await User.findById(first._id)).role).toBe('user');
		expect((await agent.delete(`/api/v1/users/${second._id}`)).status).toBe(204);
	});

	it('protect the super admin from everyone, and never hand the role out', async () => {
		const { agent: admin } = await createAdmin();
		const { agent: owner, user: superAdmin } = await createSuperAdmin();
		const { user } = await createUser();

		expect((await admin.delete(`/api/v1/users/${superAdmin._id}`)).status).toBe(403);
		expect((await admin.patch(`/api/v1/users/${superAdmin._id}/role`).send({ role: 'user' })).status).toBe(403);
		expect((await owner.delete(`/api/v1/users/${superAdmin._id}`)).status).toBe(400);
		expect((await owner.patch(`/api/v1/users/${user._id}/role`).send({ role: 'superadmin' })).status).toBe(400);
	});

	it('give the super admin everything an admin has', async () => {
		const { agent } = await createSuperAdmin();
		expect((await agent.get('/api/v1/users')).status).toBe(200);
		expect((await agent.get('/api/v1/admin/problems')).status).toBe(200);
	});

	it('keep deleting users away from regular users', async () => {
		const { agent } = await createUser();
		const { user } = await createUser();
		expect((await agent.delete(`/api/v1/users/${user._id}`)).status).toBe(403);
	});
});

describe('your stats', () => {
	it('counts solved problems in the problem set by difficulty, and lists the latest submissions', async () => {
		const { agent, user } = await createUser();
		const [easy, hard, hidden] = await Promise.all([
			createProblem({ title: 'Easy one', difficulty: 'easy' }),
			createProblem({ title: 'Hard one', difficulty: 'hard' }),
			createProblem({ title: 'Hidden one', visible: false }),
			createProblem({ title: 'Another easy', difficulty: 'easy' }),
		]);
		const submit = (problem, status, language = 'python3') =>
			Submission.create({ userId: user._id, problemId: problem._id, language, sourceCode: 'x', status });
		await submit(easy, 'WRONG_ANSWER');
		await submit(easy, 'ACCEPTED', 'cpp17');
		await submit(hard, 'TLE');
		await submit(hidden, 'ACCEPTED');

		const res = await agent.get('/api/v1/users/me/stats');
		const { stats } = res.body.data;

		expect(res.status).toBe(200);
		expect(stats).toMatchObject({ solved: 1, total: 3, tried: 1, submissions: 4, accepted: 2 });
		expect(stats.progress).toEqual({
			easy: { solved: 1, total: 2 },
			medium: { solved: 0, total: 0 },
			hard: { solved: 0, total: 1 },
		});
		expect(stats.languages).toEqual([
			{ language: 'python3', count: 3 },
			{ language: 'cpp17', count: 1 },
		]);
		expect(stats.recent).toHaveLength(4);
		expect(stats.recent[0].problemId).toHaveProperty('slug');
	});

	it('needs you to be logged in', async () => {
		expect((await request(app).get('/api/v1/users/me/stats')).status).toBe(401);
	});
});
