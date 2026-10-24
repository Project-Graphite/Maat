import mongoose from 'mongoose';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import app from '../app.js';
import Submission from '../models/submissionModel.js';
import { judgeQueue } from '../services/queue.js';
import { createAdmin, createContest, createProblem, createTestCase, createUser } from './helpers.js';

const url = '/api/v1/submissions';
const code = 'a, b = map(int, input().split())\nprint(a + b)';

let problem;

beforeEach(async () => {
	problem = await createProblem();
	await createTestCase(problem._id);
});

const submit = (agent, overrides = {}) =>
	agent.post(url).send({ problemId: problem.id, language: 'python3', sourceCode: code, ...overrides });

describe('creating a submission', () => {
	it('needs a login', async () => {
		const res = await request(app).post(url).send({ problemId: problem.id, language: 'python3', sourceCode: code });
		expect(res.status).toBe(401);
	});

	it('accepts a valid submission, saves it and queues it for the judge', async () => {
		const { agent, user } = await createUser();
		const res = await submit(agent);

		expect(res.status).toBe(202);
		expect(res.body.data.submission.status).toBe('PENDING');
		expect(res.body.data.submission.sourceCode).toBeUndefined();

		const saved = await Submission.findById(res.body.data.submission._id);
		expect(saved.userId.toString()).toBe(user._id);
		expect(saved.sourceCode).toBe(code);

		expect(judgeQueue.add).toHaveBeenCalledTimes(1);
		const [name, data, options] = judgeQueue.add.mock.calls[0];
		expect(name).toBe('judge');
		expect(data).toEqual({ submissionId: saved.id });
		expect(options.attempts).toBe(2);
	});

	it('rejects a language that is not supported', async () => {
		const { agent } = await createUser();
		expect((await submit(agent, { language: 'java' })).status).toBe(400);
		expect(judgeQueue.add).not.toHaveBeenCalled();
	});

	it('rejects missing or empty source code', async () => {
		const { agent } = await createUser();
		expect((await submit(agent, { sourceCode: undefined })).status).toBe(400);
		expect((await submit(agent, { sourceCode: '   ' })).status).toBe(400);
	});

	it('rejects source code over 64KB', async () => {
		const { agent } = await createUser();
		const res = await submit(agent, { sourceCode: 'x'.repeat(65 * 1024) });
		expect(res.status).toBe(400);
	});

	it('rejects an invalid problem id', async () => {
		const { agent } = await createUser();
		expect((await submit(agent, { problemId: 'nope' })).status).toBe(400);
	});

	it('answers 404 for a problem that does not exist', async () => {
		const { agent } = await createUser();
		const res = await submit(agent, { problemId: new mongoose.Types.ObjectId().toString() });
		expect(res.status).toBe(404);
	});

	it('answers 404 for a hidden problem', async () => {
		const { agent } = await createUser();
		const hidden = await createProblem({ title: 'Hidden', visible: false });
		await createTestCase(hidden._id);
		expect((await submit(agent, { problemId: hidden.id })).status).toBe(404);
	});

	it('lets an admin submit to a hidden problem', async () => {
		const { agent } = await createAdmin();
		const hidden = await createProblem({ title: 'Hidden', visible: false });
		await createTestCase(hidden._id);
		expect((await submit(agent, { problemId: hidden.id })).status).toBe(202);
	});

	it('refuses a problem with no test cases', async () => {
		const { agent } = await createUser();
		const empty = await createProblem({ title: 'Empty' });
		expect((await submit(agent, { problemId: empty.id })).status).toBe(400);
	});

	it('answers 503 and keeps nothing when the queue is down', async () => {
		const { agent } = await createUser();
		judgeQueue.add.mockRejectedValueOnce(new Error('redis is down'));

		const res = await submit(agent);
		expect(res.status).toBe(503);
		expect(await Submission.countDocuments()).toBe(0);
	});

	it('allows 10 submissions a minute per user, then answers 429', async () => {
		const { agent } = await createUser();
		for (let i = 0; i < 10; i++) expect((await submit(agent)).status).toBe(202);
		expect((await submit(agent)).status).toBe(429);

		// The limit belongs to the account, so another user is not affected
		const other = await createUser();
		expect((await submit(other.agent)).status).toBe(202);
	});
});

describe('reading submissions', () => {
	it('lets the owner read their submission with its source code', async () => {
		const { agent } = await createUser();
		const { body } = await submit(agent);

		const res = await agent.get(`${url}/${body.data.submission._id}`);
		expect(res.status).toBe(200);
		expect(res.body.data.submission.sourceCode).toBe(code);
	});

	it("hides one user's submission from another", async () => {
		const owner = await createUser();
		const other = await createUser();
		const { body } = await submit(owner.agent);

		expect((await other.agent.get(`${url}/${body.data.submission._id}`)).status).toBe(404);
	});

	it('lets an admin read any submission', async () => {
		const owner = await createUser();
		const { agent } = await createAdmin();
		const { body } = await submit(owner.agent);

		expect((await agent.get(`${url}/${body.data.submission._id}`)).status).toBe(200);
	});

	it('needs a login', async () => {
		const { agent } = await createUser();
		const { body } = await submit(agent);
		expect((await request(app).get(`${url}/${body.data.submission._id}`)).status).toBe(401);
	});

	it('answers 404 for a bad id', async () => {
		const { agent } = await createUser();
		expect((await agent.get(`${url}/nope`)).status).toBe(404);
	});

	it('lists only my submissions, without source code', async () => {
		const me = await createUser();
		const other = await createUser();
		await submit(me.agent);
		await submit(me.agent);
		await submit(other.agent);

		const res = await me.agent.get(url);
		expect(res.status).toBe(200);
		expect(res.body.total).toBe(2);
		expect(res.body.data.submissions[0].sourceCode).toBeUndefined();
	});

	it('filters my submissions by status', async () => {
		const { agent } = await createUser();
		const { body } = await submit(agent);
		await submit(agent);
		await Submission.updateOne({ _id: body.data.submission._id }, { status: 'ACCEPTED' });

		const res = await agent.get(`${url}?status=ACCEPTED`);
		expect(res.body.total).toBe(1);
	});
});

describe('contest submissions', () => {
	it('accepts a submission to a running contest and records the contest', async () => {
		const { agent } = await createUser();
		const contest = await createContest(problem._id);

		const res = await submit(agent, { contestId: contest.id });
		expect(res.status).toBe(202);
		const saved = await Submission.findById(res.body.data.submission._id);
		expect(saved.contestId.toString()).toBe(contest.id);
	});

	it('refuses before the contest starts', async () => {
		const { agent } = await createUser();
		const contest = await createContest(problem._id, { startsIn: 60 * 60 * 1000, endsIn: 2 * 60 * 60 * 1000 });
		expect((await submit(agent, { contestId: contest.id })).status).toBe(403);
	});

	it('refuses after the contest ends', async () => {
		const { agent } = await createUser();
		const contest = await createContest(problem._id, { startsIn: -2 * 60 * 60 * 1000, endsIn: -60 * 60 * 1000 });
		expect((await submit(agent, { contestId: contest.id })).status).toBe(403);
	});

	it('refuses a problem that is not part of the contest', async () => {
		const { agent } = await createUser();
		const contest = await createContest(problem._id);
		const other = await createProblem({ title: 'Other' });
		await createTestCase(other._id);

		expect((await submit(agent, { problemId: other.id, contestId: contest.id })).status).toBe(400);
	});

	it('rejects an invalid or unknown contest id', async () => {
		const { agent } = await createUser();
		expect((await submit(agent, { contestId: 'nope' })).status).toBe(400);
		const res = await submit(agent, { contestId: new mongoose.Types.ObjectId().toString() });
		expect(res.status).toBe(404);
	});
});
