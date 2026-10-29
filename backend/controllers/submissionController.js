import Submission, { STATUSES } from '../models/submissionModel.js';
import Problem from '../models/problemModel.js';
import TestCase from '../models/testCaseModel.js';
import Contest from '../models/contestModel.js';
import APIFeatures from '../utils/apiFeatures.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/appError.js';
import { isAdmin } from '../utils/roles.js';
import isObjectId from '../utils/isObjectId.js';
import { judgeEvents, judgeQueue } from '../services/queue.js';

const MAX_SOURCE_BYTES = 64 * 1024;
const LANGUAGES = Submission.schema.path('language').enumValues;
const RUN_TIMEOUT_MS = 60_000;

const checkContest = async (contestId, problemId) => {
    if (!isObjectId(contestId)) throw new AppError('Invalid contest ID.', 400);

    const contest = await Contest.findById(contestId);
    if (!contest) throw new AppError('No contest found with that ID.', 404);

    const now = new Date();
    if (!contest.startsAt || now < contest.startsAt || now >= contest.endsAt) {
        throw new AppError('This contest is not running.', 403);
    }
    if (!contest.problems.some((p) => p.problemId.equals(problemId))) {
        throw new AppError('That problem is not part of this contest.', 400);
    }
};

// The checks a submission and a trial run share. Throws an AppError when something is wrong
const checkCode = async ({ problemId, contestId, language, sourceCode }, user) => {
    if (!isObjectId(problemId)) throw new AppError('Invalid problem ID.', 400);
    if (!LANGUAGES.includes(language)) {
        throw new AppError(`Language must be one of: ${LANGUAGES.join(', ')}.`, 400);
    }
    if (typeof sourceCode !== 'string' || !sourceCode.trim()) {
        throw new AppError('Please provide your source code.', 400);
    }
    if (Buffer.byteLength(sourceCode) > MAX_SOURCE_BYTES) {
        throw new AppError('Source code must be 64KB or smaller.', 400);
    }

    const problem = await Problem.findById(problemId).select('visible');
    if (!problem || (!problem.visible && !isAdmin(user) && contestId === undefined)) {
        throw new AppError('No problem found with that ID.', 404);
    }

    if (!(await TestCase.exists({ problemId }))) {
        throw new AppError('This problem has no test cases yet.', 400);
    }
    if (contestId !== undefined) await checkContest(contestId, problemId);
};

const createSubmission = catchAsync(async (req, res, next) => {
    const { problemId, contestId, language, sourceCode } = req.body;
    await checkCode(req.body, req.user);

    const submission = await Submission.create({
        userId: req.user._id,
        problemId,
        contestId,
        language,
        sourceCode,
        public: req.body.public === true,
    });

    try {
        await judgeQueue.add(
            'judge',
            { submissionId: submission.id },
            { attempts: 2, removeOnComplete: 1000, removeOnFail: 1000 },
        );
    } catch (err) {
        await Submission.deleteOne({ _id: submission._id });
        return next(new AppError('The judge is unavailable right now. Please try again.', 503));
    }
    const judgeOnline = (await judgeQueue.getWorkersCount().catch(() => 0)) > 0;

    res.status(202).json({
        status: 'success',
        data: {
            submission: {
                _id: submission._id,
                status: submission.status,
                submittedAt: submission.submittedAt,
            },
            judgeOnline,
        },
    });
});

// Runs the code on the problem's examples and answers with the result. Nothing is stored
const runCode = catchAsync(async (req, res, next) => {
    const { problemId, language, sourceCode } = req.body;
    await checkCode(req.body, req.user);

    if (!(await judgeQueue.getWorkersCount().catch(() => 0))) {
        return next(new AppError('No judge is running right now, so your code cannot be run. Please try again later.', 503));
    }

    let job;
    try {
        job = await judgeQueue.add(
            'run',
            { problemId, language, sourceCode },
            { attempts: 1, removeOnComplete: { age: 300 }, removeOnFail: { age: 300 } },
        );
    } catch {
        return next(new AppError('The judge is unavailable right now. Please try again.', 503));
    }

    try {
        const run = await job.waitUntilFinished(judgeEvents, RUN_TIMEOUT_MS);
        res.status(200).json({ status: 'success', data: { run } });
    } catch {
        await job.remove().catch(() => {});
        next(new AppError('The judge is busy, so your code could not be run. Please try again in a moment.', 503));
    }
});

// Only the author can share or hide a submission
const updateSubmission = catchAsync(async (req, res, next) => {
    if (typeof req.body.public !== 'boolean') {
        return next(new AppError('Say whether the submission is public.', 400));
    }
    const submission = isObjectId(req.params.id)
        ? await Submission.findOneAndUpdate(
              { _id: req.params.id, userId: req.user._id },
              { public: req.body.public },
              { new: true },
          ).select('public')
        : null;
    if (!submission) return next(new AppError('No submission found with that ID.', 404));

    res.status(200).json({ status: 'success', data: { submission } });
});

const getSubmission = catchAsync(async (req, res, next) => {
    const submission = isObjectId(req.params.id)
        ? await Submission.findById(req.params.id).populate('problemId', 'slug title')
        : null;

    const allowed =
        submission &&
        (isAdmin(req.user) || submission.userId.equals(req.user._id));
    if (!allowed) return next(new AppError('No submission found with that ID.', 404));

    res.status(200).json({ status: 'success', data: { submission } });
});

const getMySubmissions = catchAsync(async (req, res) => {
    const filter = { userId: req.user._id };
    if (isObjectId(req.query.problemId)) filter.problemId = req.query.problemId;
    if (isObjectId(req.query.contestId)) filter.contestId = req.query.contestId;
    if (STATUSES.includes(req.query.status)) filter.status = req.query.status;

    const features = new APIFeatures(
        Submission.find(filter)
            .select('-sourceCode -compileOutput')
            .populate('problemId', 'slug title'),
        req.query,
        {
            sortable: ['submittedAt', 'status'],
            defaultSort: '-submittedAt',
            defaultLimit: 20,
            maxLimit: 100,
        },
    )
        .sort()
        .paginate();

    const [submissions, total] = await Promise.all([
        features.query,
        Submission.countDocuments(features.conditions),
    ]);

    res.status(200).json({
        status: 'success',
        results: submissions.length,
        total,
        page: features.page,
        data: { submissions },
    });
});

export { createSubmission, runCode, updateSubmission, getSubmission, getMySubmissions };
