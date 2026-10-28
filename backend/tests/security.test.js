import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../app.js';
import User from '../models/userModel.js';
import { PASSWORD, createUser, signupBody } from './helpers.js';

describe('same-origin check', () => {
	it('blocks a state-changing request that comes from another website', async () => {
		const res = await request(app)
			.post('/api/v1/auth/signup')
			.set('Origin', 'http://evil.example')
			.send(signupBody());
		expect(res.status).toBe(403);
		expect(await User.countDocuments()).toBe(0);
	});

	it('allows the real site', async () => {
		const res = await request(app)
			.post('/api/v1/auth/signup')
			.set('Origin', 'http://localhost:8080')
			.send(signupBody());
		expect(res.status).toBe(201);
	});

	it('allows requests with no Origin header, like API tools', async () => {
		const res = await request(app).post('/api/v1/auth/signup').send(signupBody());
		expect(res.status).toBe(201);
	});

	it('never checks reads', async () => {
		const res = await request(app).get('/api/v1/problems').set('Origin', 'http://evil.example');
		expect(res.status).toBe(200);
	});
});

describe('input sanitizing', () => {
	it('does not let a NoSQL operator log in without the password', async () => {
		const { email } = await createUser();
		const res = await request(app)
			.post('/api/v1/auth/login')
			.send({ email: { $gt: '' }, password: { $gt: '' } });
		expect(res.status).not.toBe(200);
		expect(res.headers['set-cookie']).toBeUndefined();

		const ok = await request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD });
		expect(ok.status).toBe(200);
	});

	it('strips scripts from text fields', async () => {
		const res = await request(app)
			.post('/api/v1/auth/signup')
			.send(signupBody({ name: '<img src=x onerror=alert(1)>' }));
		expect(res.status).toBe(201);
		expect(res.body.data.user.name).not.toContain('onerror');
	});

	it('rejects a JSON body that is too large', async () => {
		const res = await request(app)
			.post('/api/v1/auth/login')
			.send({ email: 'a@b.com', password: 'x'.repeat(20 * 1024) });
		expect(res.status).toBe(413);
	});
});

describe('rate limits', () => {
	it('slows down password guessing on one account', async () => {
		const { email } = await createUser();
		for (let i = 0; i < 10; i++) {
			const res = await request(app).post('/api/v1/auth/login').send({ email, password: 'wrong-password' });
			expect(res.status).toBe(401);
		}
		const blocked = await request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD });
		expect(blocked.status).toBe(429);
	});

	it('does not count successful logins', async () => {
		const { email } = await createUser();
		for (let i = 0; i < 12; i++) {
			expect((await request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD })).status).toBe(200);
		}
	});

	it('limits password checks per account', async () => {
		const { agent } = await createUser();
		for (let i = 0; i < 10; i++) await agent.delete('/api/v1/users/me').send({ password: 'wrong-password' });
		expect((await agent.delete('/api/v1/users/me').send({ password: 'wrong-password' })).status).toBe(429);
	});
});
