import Problem from '../models/problemModel.js';
import TestCase from '../models/testCaseModel.js';
import Submission from '../models/submissionModel.js';
import Contest from '../models/contestModel.js';
import APIFeatures from '../utils/apiFeatures.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/appError.js';
import pick from '../utils/pick.js';

const DIFFICULTIES = Problem.schema.path('difficulty').enumValues;
const EDITABLE = [
    'title',
    'statementMd',
    'timeLimitMs',
    'memoryLimitMb',
    'difficulty',
    'visible',
];

const getAllProblems = catchAsync(async (req, res) => {
    const filter = { visible: true };
    if (DIFFICULTIES.includes(req.query.difficulty)) filter.difficulty = req.query.difficulty;

    const features = new APIFeatures(
        Problem.find(filter).select('slug title difficulty timeLimitMs memoryLimitMb'),
        req.query,
        {
            searchable: 'title',
            sortable: ['title', 'difficulty', 'createdAt'],
            defaultSort: 'createdAt',
            defaultLimit: 20,
            maxLimit: 100,
        },
    )
        .search()
        .sort()
        .paginate();

    const [problems, total] = await Promise.all([
        features.query,
        Problem.countDocuments(features.conditions),
    ]);

    res.status(200).json({
        status: 'success',
        results: problems.length,
        total,
        page: features.page,
        data: { problems },
    });
});

// Needs the identify middleware so admins can open hidden problems
const getProblem = catchAsync(async (req, res, next) => {
    const filter = { slug: String(req.params.slug).toLowerCase() };
    if (!req.user || req.user.role !== 'admin') filter.visible = true;

    const problem = await Problem.findOne(filter);
    if (!problem) return next(new AppError('No problem found with that slug.', 404));

    // Only the sample cases are ever sent to the public
    const samples = await TestCase.find({ problemId: problem._id, isSample: true })
        .select('ordinal +input +expectedOutput')
        .sort('ordinal');

    res.status(200).json({ status: 'success', data: { problem, samples } });
});

// The handlers below are for admins: protect them with restrictTo('admin') in the routes

const getAllProblemsAdmin = catchAsync(async (req, res) => {
    const features = new APIFeatures(
        Problem.find().select('slug title difficulty visible createdAt'),
        req.query,
        {
            searchable: 'title',
            sortable: ['title', 'difficulty', 'createdAt', 'visible'],
            defaultSort: '-createdAt',
            defaultLimit: 20,
            maxLimit: 100,
        },
    )
        .search()
        .sort()
        .paginate();

    const [problems, total] = await Promise.all([
        features.query,
        Problem.countDocuments(features.conditions),
    ]);

    res.status(200).json({
        status: 'success',
        results: problems.length,
        total,
        page: features.page,
        data: { problems },
    });
});

const getProblemAdmin = catchAsync(async (req, res, next) => {
    const problem = await Problem.findById(req.params.id);
    if (!problem) return next(new AppError('No problem found with that ID.', 404));

    res.status(200).json({ status: 'success', data: { problem } });
});

const createProblem = catchAsync(async (req, res) => {
    const problem = await Problem.create(pick(req.body, ...EDITABLE, 'slug'));

    res.status(201).json({ status: 'success', data: { problem } });
});

// Loaded and saved (not findByIdAndUpdate) so the schema validators run
const updateProblem = catchAsync(async (req, res, next) => {
    const problem = await Problem.findById(req.params.id);
    if (!problem) return next(new AppError('No problem found with that ID.', 404));

    problem.set(pick(req.body, ...EDITABLE));
    await problem.save();

    res.status(200).json({ status: 'success', data: { problem } });
});

const deleteProblem = catchAsync(async (req, res, next) => {
    const problem = await Problem.findById(req.params.id);
    if (!problem) return next(new AppError('No problem found with that ID.', 404));

    if (await Contest.exists({ 'problems.problemId': problem._id })) {
        return next(new AppError('This problem is used in a contest. Remove it there first.', 400));
    }

    await Promise.all([
        TestCase.deleteMany({ problemId: problem._id }),
        Submission.deleteMany({ problemId: problem._id }),
        problem.deleteOne(),
    ]);

    res.status(204).send();
});

export {
    getAllProblems,
    getProblem,
    getAllProblemsAdmin,
    getProblemAdmin,
    createProblem,
    updateProblem,
    deleteProblem,
};
