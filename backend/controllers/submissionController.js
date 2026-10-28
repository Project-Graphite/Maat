import Submission, { STATUSES } from '../models/submissionModel.js';
import Problem from '../models/problemModel.js';
import TestCase from '../models/testCaseModel.js';
import Contest from '../models/contestModel.js';
import APIFeatures from '../utils/apiFeatures.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/appError.js';
import isObjectId from '../utils/isObjectId.js';
import { judgeQueue } from '../services/queue.js';

const MAX_SOURCE_BYTES = 64 * 1024;
const LANGUAGES = Submission.schema.path('language').enumValues;

const checkContest = async (contestId, problemId) => {
    if (!isObjectId(contestId)) throw new AppError('Invalid contest ID.', 400);

    const contest = await Contest.findById(contestId);
    if (!contest) throw new AppError('No contest found with that ID.', 404);

    const now = new Date();
    if (now < contest.startsAt || now >= contest.endsAt) {
        throw new AppError('This contest is not running.', 403);
    }
    if (!contest.problems.some((p) => p.problemId.equals(problemId))) {
        throw new AppError('That problem is not part of this contest.', 400);
    }
};

const createSubmission = catchAsync(async (req, res, next) => {
    const { problemId, contestId, language, sourceCode } = req.body;

    if (!isObjectId(problemId)) return next(new AppError('Invalid problem ID.', 400));
    if (!LANGUAGES.includes(language)) {
        return next(new AppError(`Language must be one of: ${LANGUAGES.join(', ')}.`, 400));
    }
    if (typeof sourceCode !== 'string' || !sourceCode.trim()) {
        return next(new AppError('Please provide your source code.', 400));
    }
    if (Buffer.byteLength(sourceCode) > MAX_SOURCE_BYTES) {
        return next(new AppError('Source code must be 64KB or smaller.', 400));
    }

    const problem = await Problem.findById(problemId).select('visible');
    if (!problem || (!problem.visible && req.user.role !== 'admin' && contestId === undefined)) {
        return next(new AppError('No problem found with that ID.', 404));
    }

    if (!(await TestCase.exists({ problemId }))) {
        return next(new AppError('This problem has no test cases yet.', 400));
    }
    if (contestId !== undefined) await checkContest(contestId, problemId);

    const submission = await Submission.create({
        userId: req.user._id,
        problemId,
        contestId,
        language,
        sourceCode,
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

const getSubmission = catchAsync(async (req, res, next) => {
    const submission = isObjectId(req.params.id)
        ? await Submission.findById(req.params.id).populate('problemId', 'slug title')
        : null;

    const allowed =
        submission &&
        (req.user.role === 'admin' || submission.userId.equals(req.user._id));
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

export { createSubmission, getSubmission, getMySubmissions };
