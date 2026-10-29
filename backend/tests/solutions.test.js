import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import app from '../app.js';
import Submission from '../models/submissionModel.js';
import { judgeQueue } from '../services/queue.js';
import { createContest, createProblem, createTestCase, createUser } from './helpers.js';

const MINUTE = 60 * 1000;

describe('trial runs on the examples', () => {
	const body = (problem) => ({ problemId: problem.id, language: 'python3', sourceCode: 'print(3)' });

	it('queue a run job and answer with its result, storing nothing', async () => {
		const { agent } = await createUser();
		const problem = await createProblem();
		await createTestCase(problem._id, { isSample: true });
		const result = { status: 'ACCEPTED', tests: [{ ordinal: 1, verdict: 'ACCEPTED', output: '3\n', logs: '' }] };
		judgeQueue.add.mockResolvedValueOnce({ waitUntilFinished: vi.fn().mockResolvedValue(result) });

		const res = await agent.post('/api/v1/submissions/run').send(body(problem));

		expect(res.status).toBe(200);
		expect(res.body.data.run).toEqual(result);
		const [name, data] = judgeQueue.add.mock.calls[0];
		expect(name).toBe('run');
		expect(data).toEqual({ problemId: problem.id, language: 'python3', sourceCode: 'print(3)' });
		expect(await Submission.countDocuments()).toBe(0);
	});

	it('say so when no judge is running', async () => {
		const { agent } = await createUser();
		const problem = await createProblem();
		await createTestCase(problem._id);
		judgeQueue.getWorkersCount.mockResolvedValueOnce(0);

		const res = await agent.post('/api/v1/submissions/run').send(body(problem));

		expect(res.status).toBe(503);
		expect(judgeQueue.add).not.toHaveBeenCalled();
	});

	it('give up and remove the job when it takes too long', async () => {
		const { agent } = await createUser();
		const problem = await createProblem();
		await createTestCase(problem._id);
		const job = { waitUntilFinished: vi.fn().mockRejectedValue(new Error('timeout')), remove: vi.fn().mockResolvedValue() };
		judgeQueue.add.mockResolvedValueOnce(job);

		const res = await agent.post('/api/v1/submissions/run').send(body(problem));

		expect(res.status).toBe(503);
		expect(job.remove).toHaveBeenCalled();
	});

	it('check the code like a submission does', async () => {
		const { agent } = await createUser();
		const problem = await createProblem();
		await createTestCase(problem._id);

		const res = await agent.post('/api/v1/submissions/run').send({ ...body(problem), language: 'ruby' });

		expect(res.status).toBe(400);
	});

	it('need you to be logged in', async () => {
		expect((await request(app).post('/api/v1/submissions/run').send({})).status).toBe(401);
	});
});

describe('sharing a solution', () => {
	it('can be chosen when submitting, and changed later by the author only', async () => {
		const { agent } = await createUser();
		const { agent: other } = await createUser();
		const problem = await createProblem();
		await createTestCase(problem._id);

		const sent = await agent
			.post('/api/v1/submissions')
			.send({ problemId: problem.id, language: 'python3', sourceCode: 'print(3)', public: true });
		const id = sent.body.data.submission._id;
		expect((await Submission.findById(id)).public).toBe(true);

		expect((await other.patch(`/api/v1/submissions/${id}`).send({ public: false })).status).toBe(404);
		const res = await agent.patch(`/api/v1/submissions/${id}`).send({ public: false });
		expect(res.status).toBe(200);
		expect((await Submission.findById(id)).public).toBe(false);
	});

	it('is private by default', async () => {
		const { agent } = await createUser();
		const problem = await createProblem();
		await createTestCase(problem._id);

		const sent = await agent.post('/api/v1/submissions').send({ problemId: problem.id, language: 'python3', sourceCode: 'x' });

		expect((await Submission.findById(sent.body.data.submission._id)).public).toBe(false);
	});
});

describe('the solutions page', () => {
	const share = (user, problem, overrides = {}) =>
		Submission.create({
			userId: user._id,
			problemId: problem._id,
			language: 'python3',
			sourceCode: 'print(3)',
			status: 'ACCEPTED',
			public: true,
			...overrides,
		});

	it('lists accepted, shared solutions with their author but not the code, to anyone', async () => {
		const { user } = await createUser();
		const problem = await createProblem();
		await share(user, problem);
		await share(user, problem, { public: false });
		await share(user, problem, { status: 'WRONG_ANSWER' });

		const res = await request(app).get(`/api/v1/problems/${problem.slug}/solutions`);

		expect(res.status).toBe(200);
		expect(res.body.total).toBe(1);
		expect(res.body.data.solutions[0].author).toMatchObject({ _id: user._id, name: user.name });
		expect(res.body.data.solutions[0].sourceCode).toBeUndefined();
	});

	it('opens one shared solution with its code', async () => {
		const { user } = await createUser();
		const problem = await createProblem();
		const solution = await share(user, problem);

		const res = await request(app).get(`/api/v1/solutions/${solution.id}`);

		expect(res.status).toBe(200);
		expect(res.body.data.solution).toMatchObject({
			sourceCode: 'print(3)',
			author: { name: user.name },
			problem: { slug: problem.slug },
		});
	});

	it('never opens a private, rejected or unknown submission as a solution', async () => {
		const { user } = await createUser();
		const problem = await createProblem();
		const hidden = await share(user, problem, { public: false });
		const wrong = await share(user, problem, { status: 'WRONG_ANSWER' });

		for (const id of [hidden.id, wrong.id, 'nope']) {
			expect((await request(app).get(`/api/v1/solutions/${id}`)).status).toBe(404);
		}
	});

	it('keeps a single solution closed while its contest runs', async () => {
		const { user } = await createUser();
		const problem = await createProblem();
		const solution = await share(user, problem);
		await createContest(problem._id);

		expect((await request(app).get(`/api/v1/solutions/${solution.id}`)).status).toBe(403);
	});

	it('is closed while a contest with the problem has not ended, then opens', async () => {
		const { user } = await createUser();
		const problem = await createProblem();
		await share(user, problem);
		const contest = await createContest(problem._id);

		const during = await request(app).get(`/api/v1/problems/${problem.slug}/solutions`);
		expect(during.status).toBe(403);

		contest.set({ startsAt: new Date(Date.now() - 120 * MINUTE), endsAt: new Date(Date.now() - MINUTE) });
		await contest.save();
		const after = await request(app).get(`/api/v1/problems/${problem.slug}/solutions`);
		expect(after.status).toBe(200);
		expect(after.body.total).toBe(1);
	});

	it('is not there for a hidden problem', async () => {
		const problem = await createProblem({ visible: false });
		expect((await request(app).get(`/api/v1/problems/${problem.slug}/solutions`)).status).toBe(404);
	});
});
