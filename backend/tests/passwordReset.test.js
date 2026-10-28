import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import app from '../app.js';
import sendEmail from '../utils/email.js';
import { createUser } from './helpers.js';

vi.mock('../utils/email.js', () => ({ default: vi.fn() }));

describe('password reset', () => {
	it('emails a link to the site, and the link sets a new password', async () => {
		const { email } = await createUser();
		const res = await request(app).post('/api/v1/auth/forgot-password').send({ email });
		expect(res.status).toBe(200);

		const link = sendEmail.mock.calls[0][0].text.match(/https?:\/\/\S+\/reset-password\/[a-f0-9]+/)[0];
		expect(link.startsWith('http://localhost:8080/reset-password/')).toBe(true);

		const token = link.split('/').pop();
		const reset = await request(app)
			.patch(`/api/v1/auth/reset-password/${token}`)
			.send({ password: 'brand-new-password', passwordConfirm: 'brand-new-password' });
		expect(reset.status).toBe(200);

		const login = await request(app).post('/api/v1/auth/login').send({ email, password: 'brand-new-password' });
		expect(login.status).toBe(200);
	});

	it('answers the same for an unknown email and sends nothing', async () => {
		const res = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'nobody@test.com' });
		expect(res.status).toBe(200);
		expect(sendEmail).not.toHaveBeenCalled();
	});

	it('rejects a made-up token', async () => {
		const res = await request(app)
			.patch(`/api/v1/auth/reset-password/${'a'.repeat(64)}`)
			.send({ password: 'brand-new-password', passwordConfirm: 'brand-new-password' });
		expect(res.status).toBe(400);
	});
});
