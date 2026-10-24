import request from 'supertest';
import app from '../app.js';
import Contest from '../models/contestModel.js';
import Problem from '../models/problemModel.js';
import TestCase from '../models/testCaseModel.js';
import User from '../models/userModel.js';

export const PASSWORD = 'password123';

let counter = 0;

export const signupBody = (overrides = {}) => {
	counter++;
	return {
		name: `Test User ${counter}`,
		email: `user${counter}@test.com`,
		password: PASSWORD,
		passwordConfirm: PASSWORD,
		...overrides,
	};
};

// A logged-in client. The agent keeps the jwt cookie between requests
export const createUser = async ({ role = 'user' } = {}) => {
	const body = signupBody();
	await request(app).post('/api/v1/auth/signup').send(body);
	if (role !== 'user') await User.updateOne({ email: body.email }, { role });

	const agent = request.agent(app);
	const res = await agent.post('/api/v1/auth/login').send({ email: body.email, password: PASSWORD });
	return { agent, user: res.body.data.user, email: body.email, token: res.headers['set-cookie'][0].match(/jwt=([^;]+)/)[1] };
};

export const createAdmin = () => createUser({ role: 'admin' });

// Data is created straight in the database, so each test starts from exactly the state it needs
export const createProblem = (overrides = {}) =>
	Problem.create({
		title: 'Sum of two numbers',
		statementMd: 'Print a + b',
		visible: true,
		...overrides,
	});

export const createTestCase = (problemId, overrides = {}) =>
	TestCase.create({
		problemId,
		ordinal: 1,
		input: '1 2\n',
		expectedOutput: '3\n',
		...overrides,
	});

const MINUTE = 60 * 1000;

export const createContest = (problemId, { startsIn = -MINUTE, endsIn = 60 * MINUTE } = {}) =>
	Contest.create({
		title: 'Weekly contest',
		startsAt: new Date(Date.now() + startsIn),
		endsAt: new Date(Date.now() + endsIn),
		problems: [{ problemId, label: 'A' }],
	});

