import Problem from '../models/problemModel.js';
import TestCase from '../models/testCaseModel.js';
import Submission from '../models/submissionModel.js';
import { withStatus } from '../services/problemStatus.js';
import Contest from '../models/contestModel.js';
import APIFeatures from '../utils/apiFeatures.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/appError.js';
import isObjectId from '../utils/isObjectId.js';
import { isAdmin } from '../utils/roles.js';
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

    const [found, total] = await Promise.all([
        features.query.lean(),
        Problem.countDocuments(features.conditions),
    ]);
    const problems = await withStatus(found, req.user);

    res.status(200).json({
        status: 'success',
        results: problems.length,
        total,
        page: features.page,
        data: { problems },
    });
});

// A problem is open when it is in the problem set, or part of a contest that has started
const isOpen = async (problem, user) =>
    Boolean(
        problem &&
            (problem.visible ||
                isAdmin(user) ||
                (await Contest.exists({ 'problems.problemId': problem._id, startsAt: { $lte: new Date() } }))),
    );

const findOpenProblem = async (slug, user) => {
    const problem = await Problem.findOne({ slug: String(slug).toLowerCase() });
    if (!(await isOpen(problem, user))) throw new AppError('No problem found with that slug.', 404);
    return problem;
};

// Shared solutions stay closed while a contest with the problem is upcoming or running,
// so nobody can copy an answer during it
const checkSolutionsOpen = async (problem) => {
    if (await Contest.exists({ 'problems.problemId': problem._id, endsAt: { $gt: new Date() } })) {
        throw new AppError('Solutions to this problem are shown once its contest has ended.', 403);
    }
};

const SHARED = { public: true, status: 'ACCEPTED' };
const author = (user) => (user ? { _id: user._id, name: user.name, photo: user.photo } : { name: 'Deleted user' });

const getProblem = catchAsync(async (req, res) => {
    const problem = await findOpenProblem(req.params.slug, req.user);

    const samples = await TestCase.find({ problemId: problem._id, isSample: true })
        .select('ordinal +input +expectedOutput')
        .sort('ordinal');

    res.status(200).json({ status: 'success', data: { problem, samples } });
});

const SOLUTIONS_PER_PAGE = 10;

// Accepted solutions their authors chose to share, without the code. Each one opens on its own page
const getSolutions = catchAsync(async (req, res) => {
    const problem = await findOpenProblem(req.params.slug, req.user);
    await checkSolutionsOpen(problem);

    const filter = { problemId: problem._id, ...SHARED };
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const [solutions, total] = await Promise.all([
        Submission.find(filter)
            .sort('-submittedAt')
            .skip((page - 1) * SOLUTIONS_PER_PAGE)
            .limit(SOLUTIONS_PER_PAGE)
            .select('userId language submittedAt')
            .populate('userId', 'name photo'),
        Submission.countDocuments(filter),
    ]);

    res.status(200).json({
        status: 'success',
        results: solutions.length,
        total,
        page,
        data: {
            problem: { _id: problem._id, slug: problem.slug, title: problem.title },
            solutions: solutions.map(({ _id, userId, language, submittedAt }) => ({
                _id,
                author: author(userId),
                language,
                submittedAt,
            })),
        },
    });
});

const getSolution = catchAsync(async (req, res, next) => {
    const solution = isObjectId(req.params.id)
        ? await Submission.findOne({ _id: req.params.id, ...SHARED })
              .select('userId problemId language sourceCode submittedAt')
              .populate('userId', 'name photo')
              .populate('problemId')
        : null;
    if (!solution || !(await isOpen(solution.problemId, req.user))) {
        return next(new AppError('No solution found with that ID.', 404));
    }
    const problem = solution.problemId;
    await checkSolutionsOpen(problem);

    res.status(200).json({
        status: 'success',
        data: {
            solution: {
                _id: solution._id,
                author: author(solution.userId),
                language: solution.language,
                sourceCode: solution.sourceCode,
                submittedAt: solution.submittedAt,
                problem: { _id: problem._id, slug: problem.slug, title: problem.title },
            },
        },
    });
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
    getSolutions,
    getSolution,
    getAllProblemsAdmin,
    getProblemAdmin,
    createProblem,
    updateProblem,
    deleteProblem,
};
