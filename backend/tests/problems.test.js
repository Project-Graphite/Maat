import { describe, expect, it } from 'vitest';
import Contest from '../models/contestModel.js';
import Submission from '../models/submissionModel.js';
import Problem from '../models/problemModel.js';
import TestCase from '../models/testCaseModel.js';
import { createAdmin, createContest, createProblem, createTestCase, createUser } from './helpers.js';
import request from 'supertest';
import app from '../app.js';

const admin = '/api/v1/admin/problems';

describe('admin access', () => {
	it('needs a login', async () => {
		expect((await request(app).get(admin)).status).toBe(401);
	});

	it('is closed to normal users', async () => {
		const { agent } = await createUser();
		expect((await agent.get(admin)).status).toBe(403);
		expect((await agent.post(admin).send({ title: 'x', statementMd: 'y' })).status).toBe(403);
	});

	it('is open to admins', async () => {
		const { agent } = await createAdmin();
		expect((await agent.get(admin)).status).toBe(200);
	});
});

describe('admin problems', () => {
	it('creates a problem and builds the slug from the title', async () => {
		const { agent } = await createAdmin();
		const res = await agent.post(admin).send({ title: 'Sum of two numbers', statementMd: 'Print a + b' });

		expect(res.status).toBe(201);
		expect(res.body.data.problem.slug).toBe('sum-of-two-numbers');
		expect(res.body.data.problem.visible).toBe(false);
		expect(res.body.data.problem.timeLimitMs).toBe(2000);
	});

	it('rejects a missing statement', async () => {
		const { agent } = await createAdmin();
		const res = await agent.post(admin).send({ title: 'No statement' });
		expect(res.status).toBe(400);
	});

	it('rejects a time limit that is out of range', async () => {
		const { agent } = await createAdmin();
		const res = await agent.post(admin).send({ title: 'Fast', statementMd: 'x', timeLimitMs: 50 });
		expect(res.status).toBe(400);
	});

	it('rejects a duplicate slug', async () => {
		const { agent } = await createAdmin();
		await createProblem({ slug: 'taken' });
		const res = await agent.post(admin).send({ title: 'Other', statementMd: 'x', slug: 'taken' });
		expect(res.status).toBe(400);
	});

	it('updates a problem', async () => {
		const { agent } = await createAdmin();
		const problem = await createProblem();
		const res = await agent.patch(`${admin}/${problem.id}`).send({ title: 'Renamed', visible: false });

		expect(res.status).toBe(200);
		expect(res.body.data.problem.title).toBe('Renamed');
		expect(res.body.data.problem.visible).toBe(false);
	});

	it('does not let the slug be changed by an update', async () => {
		const { agent } = await createAdmin();
		const problem = await createProblem({ slug: 'keep-me' });
		await agent.patch(`${admin}/${problem.id}`).send({ slug: 'changed' });
		expect((await Problem.findById(problem.id)).slug).toBe('keep-me');
	});

	it('lists hidden problems for admins', async () => {
		const { agent } = await createAdmin();
		await createProblem({ visible: false });
		const res = await agent.get(admin);
		expect(res.body.total).toBe(1);
	});

	it('deletes a problem together with its test cases', async () => {
		const { agent } = await createAdmin();
		const problem = await createProblem();
		await createTestCase(problem._id);

		expect((await agent.delete(`${admin}/${problem.id}`)).status).toBe(204);
		expect(await Problem.countDocuments()).toBe(0);
		expect(await TestCase.countDocuments()).toBe(0);
	});

	it('refuses to delete a problem used in a contest', async () => {
		const { agent } = await createAdmin();
		const problem = await createProblem();
		await createContest(problem._id);

		expect((await agent.delete(`${admin}/${problem.id}`)).status).toBe(400);
		expect(await Problem.countDocuments()).toBe(1);
		expect(await Contest.countDocuments()).toBe(1);
	});
});

describe('admin test cases', () => {
	it('numbers new test cases one after another', async () => {
		const { agent } = await createAdmin();
		const problem = await createProblem();
		const url = `${admin}/${problem.id}/testcases`;

		const first = await agent.post(url).send({ input: '1 2\n', expectedOutput: '3\n' });
		const second = await agent.post(url).send({ input: '2 3\n', expectedOutput: '5\n', isSample: true });

		expect(first.status).toBe(201);
		expect(first.body.data.testCase.ordinal).toBe(1);
		expect(second.body.data.testCase.ordinal).toBe(2);
	});

	it('adds several at once', async () => {
		const { agent } = await createAdmin();
		const problem = await createProblem();
		const res = await agent.post(`${admin}/${problem.id}/testcases/bulk`).send({
			testCases: [
				{ input: '1 1\n', expectedOutput: '2\n' },
				{ input: '2 2\n', expectedOutput: '4\n' },
			],
		});

		expect(res.status).toBe(201);
		expect(await TestCase.countDocuments({ problemId: problem._id })).toBe(2);
	});

	it('shows the data to admins', async () => {
		const { agent } = await createAdmin();
		const problem = await createProblem();
		await createTestCase(problem._id, { input: 'SECRET-IN\n', expectedOutput: 'SECRET-OUT\n' });

		const res = await agent.get(`${admin}/${problem.id}/testcases`);
		expect(res.body.data.testCases[0].input).toBe('SECRET-IN\n');
		expect(res.body.data.testCases[0].expectedOutput).toBe('SECRET-OUT\n');
	});

	it('is closed to normal users', async () => {
		const { agent } = await createUser();
		const problem = await createProblem();
		expect((await agent.get(`${admin}/${problem.id}/testcases`)).status).toBe(403);
	});

	it('answers 404 for a problem that does not exist', async () => {
		const { agent } = await createAdmin();
		const res = await agent.post(`${admin}/${'a'.repeat(24)}/testcases`).send({ input: '1', expectedOutput: '1' });
		expect(res.status).toBe(404);
	});

	it('rejects isSample that is not a boolean', async () => {
		const { agent } = await createAdmin();
		const problem = await createProblem();
		const res = await agent.post(`${admin}/${problem.id}/testcases`).send({ input: '1', isSample: 'yes' });
		expect(res.status).toBe(400);
	});

	it('rejects a field over 1MB', async () => {
		const { agent } = await createAdmin();
		const problem = await createProblem();
		const res = await agent
			.post(`${admin}/${problem.id}/testcases`)
			.send({ input: 'x'.repeat(1024 * 1024 + 1), expectedOutput: '1' });
		expect(res.status).toBe(400);
	});
});

describe('public problems', () => {
	it('lists only visible problems', async () => {
		await createProblem({ title: 'Shown' });
		await createProblem({ title: 'Hidden', visible: false });

		const res = await request(app).get('/api/v1/problems');
		expect(res.status).toBe(200);
		expect(res.body.total).toBe(1);
		expect(res.body.data.problems[0].title).toBe('Shown');
	});

	it('does not send statements in the list', async () => {
		await createProblem();
		const res = await request(app).get('/api/v1/problems');
		expect(res.body.data.problems[0].statementMd).toBeUndefined();
	});

	it('filters by difficulty', async () => {
		await createProblem({ title: 'Easy one', difficulty: 'easy' });
		await createProblem({ title: 'Hard one', difficulty: 'hard' });

		const res = await request(app).get('/api/v1/problems?difficulty=hard');
		expect(res.body.data.problems.map((p) => p.title)).toEqual(['Hard one']);
	});

	it('shows a problem with only its sample test cases', async () => {
		const problem = await createProblem({ slug: 'sum' });
		await createTestCase(problem._id, { ordinal: 1, isSample: true, input: 'SAMPLE-IN\n', expectedOutput: 'SAMPLE-OUT\n' });
		await createTestCase(problem._id, { ordinal: 2, input: 'HIDDEN-SECRET-IN\n', expectedOutput: 'HIDDEN-SECRET-OUT\n' });

		const res = await request(app).get('/api/v1/problems/sum');
		expect(res.status).toBe(200);
		expect(res.body.data.samples).toHaveLength(1);
		expect(res.body.data.samples[0].input).toBe('SAMPLE-IN\n');
		// The hidden test data must not appear anywhere in the response
		expect(JSON.stringify(res.body)).not.toContain('HIDDEN-SECRET');
	});

	it('hides a hidden problem from the public and from users', async () => {
		await createProblem({ slug: 'secret', visible: false });
		const { agent } = await createUser();

		expect((await request(app).get('/api/v1/problems/secret')).status).toBe(404);
		expect((await agent.get('/api/v1/problems/secret')).status).toBe(404);
	});

	it('lets an admin open a hidden problem', async () => {
		await createProblem({ slug: 'secret', visible: false });
		const { agent } = await createAdmin();
		expect((await agent.get('/api/v1/problems/secret')).status).toBe(200);
	});

	it('answers 404 for an unknown slug', async () => {
		expect((await request(app).get('/api/v1/problems/nope')).status).toBe(404);
	});
});

describe('problem status', () => {
	const statusOf = (res, title) => res.body.data.problems.find((p) => p.title === title).status;

	it('shows solved, tried, or nothing for each problem', async () => {
		const { agent, user } = await createUser();
		const solved = await createProblem({ title: 'Solved one' });
		const tried = await createProblem({ title: 'Tried one' });
		await createProblem({ title: 'Untouched' });
		const submit = (problem, status) =>
			Submission.create({ userId: user._id, problemId: problem._id, language: 'python3', sourceCode: 'x', status });
		await submit(solved, 'WRONG_ANSWER');
		await submit(solved, 'ACCEPTED');
		await submit(tried, 'TLE');

		const res = await agent.get('/api/v1/problems');
		expect(statusOf(res, 'Solved one')).toBe('solved');
		expect(statusOf(res, 'Tried one')).toBe('tried');
		expect(statusOf(res, 'Untouched')).toBeNull();
	});

	it('is left out for visitors', async () => {
		await createProblem({ title: 'Solved one' });
		const res = await request(app).get('/api/v1/problems');
		expect(res.body.data.problems[0].status).toBeUndefined();
	});

	it('counts only submissions made in the contest on a contest page', async () => {
		const { agent, user } = await createUser();
		const problem = await createProblem();
		const contest = await createContest(problem._id);
		await Submission.create({ userId: user._id, problemId: problem._id, language: 'python3', sourceCode: 'x', status: 'ACCEPTED' });

		const before = await agent.get(`/api/v1/contests/${contest.id}`);
		expect(before.body.data.contest.problems[0].status).toBeNull();

		await Submission.create({ userId: user._id, problemId: problem._id, contestId: contest._id, language: 'python3', sourceCode: 'x', status: 'ACCEPTED' });
		const after = await agent.get(`/api/v1/contests/${contest.id}`);
		expect(after.body.data.contest.problems[0].status).toBe('solved');
	});
});
