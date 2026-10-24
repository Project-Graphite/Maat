import { describe, expect, it } from 'vitest';
import { createAdmin, createUser } from './helpers.js';

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

	it('lets an admin list users and change a role', async () => {
		const { agent } = await createAdmin();
		const { user } = await createUser();

		expect((await agent.get('/api/v1/users')).status).toBe(200);
		const res = await agent.patch(`/api/v1/users/${user._id}/role`).send({ role: 'admin' });
		expect(res.status).toBe(200);
		expect(res.body.data.user.role).toBe('admin');
	});

	it('does not let an admin change their own role', async () => {
		const { agent, user } = await createAdmin();
		const res = await agent.patch(`/api/v1/users/${user._id}/role`).send({ role: 'user' });
		expect(res.status).toBe(400);
	});

	it('rejects an unknown role', async () => {
		const { agent } = await createAdmin();
		const { user } = await createUser();
		const res = await agent.patch(`/api/v1/users/${user._id}/role`).send({ role: 'superuser' });
		expect(res.status).toBe(400);
	});
});
