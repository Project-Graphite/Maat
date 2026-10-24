import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../app.js';
import User from '../models/userModel.js';
import { PASSWORD, createUser, signupBody } from './helpers.js';

const auth = '/api/v1/auth';

describe('signup', () => {
	it('creates the user, logs them in and never returns the password', async () => {
		const body = signupBody();
		const res = await request(app).post(`${auth}/signup`).send(body);

		expect(res.status).toBe(201);
		expect(res.body.data.user.email).toBe(body.email);
		expect(res.body.data.user.password).toBeUndefined();
		expect(res.headers['set-cookie'][0]).toMatch(/^jwt=.+HttpOnly/);
	});

	it('stores a hashed password', async () => {
		const body = signupBody();
		await request(app).post(`${auth}/signup`).send(body);
		const user = await User.findOne({ email: body.email }).select('+password');
		expect(user.password).not.toBe(body.password);
	});

	it('ignores a role sent by the client', async () => {
		const res = await request(app).post(`${auth}/signup`).send(signupBody({ role: 'admin' }));
		expect(res.status).toBe(201);
		expect(res.body.data.user.role).toBe('user');
	});

	it('rejects passwords that do not match', async () => {
		const res = await request(app)
			.post(`${auth}/signup`)
			.send(signupBody({ passwordConfirm: 'different123' }));
		expect(res.status).toBe(400);
	});

	it('rejects a short password', async () => {
		const res = await request(app)
			.post(`${auth}/signup`)
			.send(signupBody({ password: 'short', passwordConfirm: 'short' }));
		expect(res.status).toBe(400);
	});

	it('rejects an invalid email', async () => {
		const res = await request(app)
			.post(`${auth}/signup`)
			.send(signupBody({ email: 'not-an-email' }));
		expect(res.status).toBe(400);
	});

	it('rejects a duplicate email', async () => {
		const body = signupBody();
		await request(app).post(`${auth}/signup`).send(body);
		const res = await request(app).post(`${auth}/signup`).send({ ...body, name: 'Someone Else' });
		expect(res.status).toBe(400);
		expect(await User.countDocuments({ email: body.email })).toBe(1);
	});
});

describe('login', () => {
	it('logs in with the right password', async () => {
		const { email } = await createUser();
		const res = await request(app).post(`${auth}/login`).send({ email, password: PASSWORD });
		expect(res.status).toBe(200);
		expect(res.headers['set-cookie'][0]).toContain('jwt=');
	});

	it('rejects a wrong password', async () => {
		const { email } = await createUser();
		const res = await request(app)
			.post(`${auth}/login`)
			.send({ email, password: 'wrong-password' });
		expect(res.status).toBe(401);
		expect(res.headers['set-cookie']).toBeUndefined();
	});

	it('gives the same answer for an unknown email', async () => {
		const res = await request(app)
			.post(`${auth}/login`)
			.send({ email: 'nobody@test.com', password: PASSWORD });
		expect(res.status).toBe(401);
		expect(res.body.message).toBe('Incorrect email or password');
	});

	it('requires both fields', async () => {
		const res = await request(app).post(`${auth}/login`).send({ email: 'a@b.com' });
		expect(res.status).toBe(400);
	});
});

describe('who am I', () => {
	it('needs a login', async () => {
		const res = await request(app).get('/api/v1/users/me');
		expect(res.status).toBe(401);
	});

	it('works with the cookie', async () => {
		const { agent, email } = await createUser();
		const res = await agent.get('/api/v1/users/me');
		expect(res.status).toBe(200);
		expect(res.body.data.user.email).toBe(email);
	});

	it('works with a Bearer token', async () => {
		const { token, email } = await createUser();
		const res = await request(app)
			.get('/api/v1/users/me')
			.set('Authorization', `Bearer ${token}`);
		expect(res.status).toBe(200);
		expect(res.body.data.user.email).toBe(email);
	});

	it('rejects a forged token', async () => {
		const res = await request(app)
			.get('/api/v1/users/me')
			.set('Authorization', 'Bearer not.a.token');
		expect(res.status).toBe(401);
	});

	it('rejects a token for a user who no longer exists', async () => {
		const { token, user } = await createUser();
		await User.deleteOne({ _id: user._id });
		const res = await request(app)
			.get('/api/v1/users/me')
			.set('Authorization', `Bearer ${token}`);
		expect(res.status).toBe(401);
	});
});

// A token counts as old only once a full second has passed since it was issued, because JWT
// timestamps are whole seconds. Password changes backdate the change by one more second, so
// the fresh token from the same request works. Wait out both before checking a token is dead.
const letTokenAge = () => new Promise((resolve) => setTimeout(resolve, 2100));

describe('logout', () => {
	it('invalidates the token, even if it is replayed', async () => {
		const { agent, token } = await createUser();
		await letTokenAge();
		expect((await agent.post(`${auth}/logout`)).status).toBe(200);

		const res = await request(app)
			.get('/api/v1/users/me')
			.set('Authorization', `Bearer ${token}`);
		expect(res.status).toBe(401);
	});
});

describe('password change', () => {
	const newPassword = 'new-password-456';

	it('changes the password and kills the old token', async () => {
		const { agent, email, token } = await createUser();
		await letTokenAge();
		const res = await agent.patch(`${auth}/update-password`).send({
			passwordCurrent: PASSWORD,
			password: newPassword,
			passwordConfirm: newPassword,
		});
		expect(res.status).toBe(200);

		const old = await request(app)
			.get('/api/v1/users/me')
			.set('Authorization', `Bearer ${token}`);
		expect(old.status).toBe(401);
		const login = await request(app).post(`${auth}/login`).send({ email, password: newPassword });
		expect(login.status).toBe(200);
	});

	it('requires the current password', async () => {
		const { agent } = await createUser();
		const res = await agent.patch(`${auth}/update-password`).send({
			passwordCurrent: 'wrong-password',
			password: newPassword,
			passwordConfirm: newPassword,
		});
		expect(res.status).toBe(401);
	});
});
