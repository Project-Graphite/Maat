import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../app.js';
import Contest from '../models/contestModel.js';
import Problem from '../models/problemModel.js';
import Submission from '../models/submissionModel.js';
import TestCase from '../models/testCaseModel.js';
import { publishEndedContests } from '../services/contestPublishing.js';
import { redis } from '../services/redis.js';
import { createAdmin, createContest, createProblem, createTestCase, createUser } from './helpers.js';

const draft = (problemId) =>
	Contest.create({ title: 'Draft', problems: [{ problemId, label: 'A' }] });

describe('unscheduled contests', () => {
	it('can be saved without a start and end time', async () => {
		const { agent } = await createAdmin();
		const problem = await createProblem();

		const res = await agent
			.post('/api/v1/contests')
			.send({ title: 'Later', startsAt: null, endsAt: null, problems: [{ problemId: problem.id, label: 'A' }] });

		expect(res.status).toBe(201);
		expect(res.body.data.contest.startsAt).toBeNull();
	});

	it('need both times or neither', async () => {
		const { agent } = await createAdmin();
		const problem = await createProblem();

		const res = await agent
			.post('/api/v1/contests')
			.send({ title: 'Half', startsAt: new Date().toISOString(), problems: [{ problemId: problem.id, label: 'A' }] });

		expect(res.status).toBe(400);
	});

	it('are hidden from everyone but admins', async () => {
		const problem = await createProblem();
		const contest = await draft(problem._id);
		const { agent: user } = await createUser();
		const { agent: admin } = await createAdmin();

		expect((await request(app).get('/api/v1/contests')).body.total).toBe(0);
		expect((await user.get(`/api/v1/contests/${contest.id}`)).status).toBe(404);
		expect((await user.get(`/api/v1/contests/${contest.id}/standings`)).status).toBe(403);

		const list = await admin.get('/api/v1/contests');
		expect(list.body.data.contests[0].status).toBe('unscheduled');
		expect((await admin.get(`/api/v1/contests/${contest.id}`)).body.data.contest.status).toBe('unscheduled');
	});

	it('refuse submissions', async () => {
		const problem = await createProblem();
		await createTestCase(problem._id);
		const contest = await draft(problem._id);
		const { agent } = await createUser();

		const res = await agent
			.post('/api/v1/submissions')
			.send({ problemId: problem.id, contestId: contest.id, language: 'python3', sourceCode: 'print(1)' });

		expect(res.status).toBe(403);
	});

	it('can be scheduled or started straight away later', async () => {
		const { agent } = await createAdmin();
		const problem = await createProblem();
		const contest = await draft(problem._id);
		const now = Date.now();

		const res = await agent
			.patch(`/api/v1/contests/${contest.id}`)
			.send({ startsAt: new Date(now).toISOString(), endsAt: new Date(now + 3_600_000).toISOString() });

		expect(res.status).toBe(200);
		expect((await agent.get(`/api/v1/contests/${contest.id}`)).body.data.contest.status).toBe('running');
	});
});

describe('deleting a contest', () => {
	const setUp = async () => {
		const { agent } = await createAdmin();
		const { user } = await createUser();
		const problem = await createProblem({ visible: false });
		await createTestCase(problem._id);
		const contest = await createContest(problem._id);
		await Submission.create({ userId: user._id, problemId: problem._id, contestId: contest._id, language: 'python3', sourceCode: 'x' });
		redis.zrange.mockResolvedValueOnce([user._id.toString()]);
		return { agent, problem, contest, user };
	};

	it('can delete everything, including its problems', async () => {
		const { agent, problem, contest, user } = await setUp();

		const res = await agent.delete(`/api/v1/contests/${contest.id}`);

		expect(res.status).toBe(204);
		expect(await Contest.exists({ _id: contest._id })).toBeNull();
		expect(await Problem.exists({ _id: problem._id })).toBeNull();
		expect(await TestCase.countDocuments()).toBe(0);
		expect(await Submission.countDocuments()).toBe(0);
		expect(redis.del).toHaveBeenCalledWith(`contest:${contest.id}:board`, `contest:${contest.id}:u:${user._id}`);
	});

	it('can keep the problems and publish them in the problem set', async () => {
		const { agent, problem, contest } = await setUp();

		const res = await agent.delete(`/api/v1/contests/${contest.id}?keepProblems=true`);

		expect(res.status).toBe(204);
		expect(await Contest.exists({ _id: contest._id })).toBeNull();
		expect((await Problem.findById(problem._id)).visible).toBe(true);
		expect(await TestCase.countDocuments({ problemId: problem._id })).toBe(1);
		expect(await Submission.countDocuments()).toBe(0);
	});

	it('keeps problems another contest still uses', async () => {
		const { agent, problem, contest } = await setUp();
		await createContest(problem._id);

		await agent.delete(`/api/v1/contests/${contest.id}`);

		expect(await Problem.exists({ _id: problem._id })).not.toBeNull();
	});

	it('is for admins only', async () => {
		const { contest } = await setUp();
		const { agent } = await createUser();

		expect((await agent.delete(`/api/v1/contests/${contest.id}`)).status).toBe(403);
	});
});

describe('when a contest ends', () => {
	const MINUTE = 60 * 1000;
	const ended = { startsIn: -120 * MINUTE, endsIn: -MINUTE };

	it('adds its problems to the problem set, once', async () => {
		const problem = await createProblem({ visible: false });
		await createContest(problem._id, ended);

		expect(await publishEndedContests()).toBe(1);
		expect((await Problem.findById(problem._id)).visible).toBe(true);

		await Problem.updateOne({ _id: problem._id }, { visible: false });
		expect(await publishEndedContests()).toBe(0);
		expect((await Problem.findById(problem._id)).visible).toBe(false);
	});

	it('leaves the problems of running, upcoming and unscheduled contests hidden', async () => {
		const running = await createProblem({ title: 'Running', visible: false });
		const upcoming = await createProblem({ title: 'Upcoming', visible: false });
		const unscheduled = await createProblem({ title: 'Unscheduled', visible: false });
		await createContest(running._id);
		await createContest(upcoming._id, { startsIn: MINUTE, endsIn: 60 * MINUTE });
		await draft(unscheduled._id);

		expect(await publishEndedContests()).toBe(0);
		expect(await Problem.countDocuments({ visible: true })).toBe(0);
	});

	it('waits for every contest that uses the problem to end', async () => {
		const problem = await createProblem({ visible: false });
		await createContest(problem._id, ended);
		const later = await createContest(problem._id, { startsIn: MINUTE, endsIn: 60 * MINUTE });

		await publishEndedContests();
		expect((await Problem.findById(problem._id)).visible).toBe(false);

		later.set({ startsAt: new Date(Date.now() - 120 * MINUTE), endsAt: new Date(Date.now() - MINUTE) });
		await later.save();
		await publishEndedContests();
		expect((await Problem.findById(problem._id)).visible).toBe(true);
	});
});
