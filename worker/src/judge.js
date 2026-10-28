import { chmod, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import Contest from './models/contestModel.js';
import Problem from './models/problemModel.js';
import Submission from './models/submissionModel.js';
import TestCase from './models/testCaseModel.js';
import { LANGUAGES, compile, run } from './sandbox.js';
import { applyVerdict, minutesSinceStart } from './services/leaderboard.js';
import { redis } from './services/redis.js';
import { classify } from './verdict.js';

const JOBS_DIR = process.env.JOBS_DIR || '/opt/maat-jobs';
const FINAL = new Set(['ACCEPTED', 'WRONG_ANSWER', 'TLE', 'MLE', 'RUNTIME_ERROR', 'COMPILE_ERROR', 'SYSTEM_ERROR']);
const VERDICT_CHANNEL = 'verdicts';

const runTests = async (submission, problem, testCases, jobDir) => {
	const { language } = submission;

	const compiled = await compile({ language, workDir: jobDir });
	if (!compiled.ok) {
		return { status: 'COMPILE_ERROR', compileOutput: compiled.output, tests: [] };
	}

	const tests = [];
	let status = 'ACCEPTED';
	for (const testCase of testCases) {
		const result = await run({
			language,
			workDir: jobDir,
			input: testCase.input,
			timeLimitMs: problem.timeLimitMs,
			memoryLimitMb: problem.memoryLimitMb,
		});
		const verdict = classify(result, testCase.expectedOutput);
		tests.push({ ordinal: testCase.ordinal, verdict, timeMs: result.timeMs });

		if (verdict !== 'ACCEPTED') {
			status = verdict;
			break;
		}
	}
	return { status, tests };
};

const publishVerdict = (submission, { status, compileOutput, tests, judgedAt }) =>
	redis.publish(
		VERDICT_CHANNEL,
		JSON.stringify({
			submissionId: submission.id,
			userId: submission.userId,
			contestId: submission.contestId,
			problemId: submission.problemId,
			status,
			compileOutput,
			tests,
			judgedAt,
		}),
	);

export const judgeSubmission = async (submissionId) => {
	const submission = await Submission.findById(submissionId);
	if (!submission || FINAL.has(submission.status)) return;

	const [problem, testCases] = await Promise.all([
		Problem.findById(submission.problemId),
		TestCase.find({ problemId: submission.problemId })
			.select('+input +expectedOutput')
			.sort('ordinal'),
	]);
	if (!problem || !testCases.length) {
		throw new Error(`Problem ${submission.problemId} is missing or has no test cases`);
	}

	await Submission.updateOne({ _id: submission._id }, { status: 'RUNNING' });
	const jobDir = path.join(JOBS_DIR, submission.id);
	let outcome;
	try {
		await mkdir(jobDir, { recursive: true });
		await chmod(jobDir, 0o777);
		await writeFile(
			path.join(jobDir, LANGUAGES[submission.language].sourceFile),
			submission.sourceCode,
		);
		outcome = await runTests(submission, problem, testCases, jobDir);
	} finally {
		await rm(jobDir, { recursive: true, force: true });
	}

	const judgedAt = new Date();
	await Submission.updateOne(
		{ _id: submission._id },
		{
			status: outcome.status,
			compileOutput: outcome.compileOutput,
			tests: outcome.tests,
			judgedAt,
		},
	);

	if (submission.contestId) {
		const contest = await Contest.findById(submission.contestId).select('startsAt');
		if (contest) {
			await applyVerdict({
				contestId: submission.contestId,
				userId: submission.userId,
				problemId: submission.problemId,
				verdict: outcome.status,
				minutes: minutesSinceStart(contest, submission.submittedAt),
			});
		}
	}

	await publishVerdict(submission, { ...outcome, judgedAt });
};

/**
 * Called when judging has failed for good (every retry used, or the job stalled out). Without
 * this the submission would stay RUNNING forever. It scores nothing in a contest, since the
 * failure is ours and not the contestant's.
 */
export const failSubmission = async (submissionId) => {
	const submission = await Submission.findById(submissionId);
	if (!submission || FINAL.has(submission.status)) return;

	const outcome = { status: 'SYSTEM_ERROR', tests: [], judgedAt: new Date() };
	await Submission.updateOne(
		{ _id: submission._id },
		{ status: outcome.status, tests: outcome.tests, judgedAt: outcome.judgedAt },
	);
	await publishVerdict(submission, outcome);
};
