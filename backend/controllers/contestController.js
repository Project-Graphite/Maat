import Contest from '../models/contestModel.js';
import Problem from '../models/problemModel.js';
import APIFeatures from '../utils/apiFeatures.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/appError.js';
import isObjectId from '../utils/isObjectId.js';
import pick from '../utils/pick.js';
import { withStatus } from '../services/problemStatus.js';

const EDITABLE = ['title', 'startsAt', 'endsAt', 'problems'];

const statusOf = (contest, now = new Date()) => {
    if (now < contest.startsAt) return 'upcoming';
    if (now >= contest.endsAt) return 'ended';
    return 'running';
};

const statusFilter = (status, now = new Date()) => {
    if (status === 'upcoming') return { startsAt: { $gt: now } };
    if (status === 'running') return { startsAt: { $lte: now }, endsAt: { $gt: now } };
    if (status === 'ended') return { endsAt: { $lte: now } };
    return {};
};

const validateProblems = async (problems) => {
    if (!Array.isArray(problems) || problems.length === 0) {
        throw new AppError('A contest needs at least one problem.', 400);
    }

    const ids = new Set();
    const labels = new Set();
    for (const item of problems) {
        if (!item || !isObjectId(item.problemId) || typeof item.label !== 'string' || !item.label.trim()) {
            throw new AppError('Each problem needs a problemId and a label.', 400);
        }
        const label = item.label.trim().toUpperCase();
        if (ids.has(item.problemId) || labels.has(label)) {
            throw new AppError('Problems and labels must be unique within a contest.', 400);
        }
        ids.add(item.problemId);
        labels.add(label);
    }

    if ((await Problem.countDocuments({ _id: { $in: [...ids] } })) !== ids.size) {
        throw new AppError('One or more problems do not exist.', 400);
    }
};

const getAllContests = catchAsync(async (req, res) => {
    const features = new APIFeatures(
        Contest.find(statusFilter(req.query.status)).select('title startsAt endsAt'),
        req.query,
        {
            sortable: ['startsAt', 'endsAt', 'title'],
            defaultSort: '-startsAt',
            defaultLimit: 20,
            maxLimit: 100,
        },
    )
        .sort()
        .paginate();

    const [contests, total] = await Promise.all([
        features.query,
        Contest.countDocuments(features.conditions),
    ]);

    res.status(200).json({
        status: 'success',
        results: contests.length,
        total,
        page: features.page,
        data: {
            contests: contests.map((c) => ({ ...c.toObject(), status: statusOf(c) })),
        },
    });
});

const getContest = catchAsync(async (req, res, next) => {
    const contest = isObjectId(req.params.id)
        ? await Contest.findById(req.params.id).populate(
              'problems.problemId',
              'slug title difficulty',
          )
        : null;
    if (!contest) return next(new AppError('No contest found with that ID.', 404));

    const data = contest.toObject();
    data.status = statusOf(contest);
    if (data.status === 'upcoming' && (!req.user || req.user.role !== 'admin')) {
        data.problems = [];
    } else {
        data.problems = data.problems
            .filter((p) => p.problemId)
            .map(({ label, problemId }) => ({ label, ...problemId }));
        data.problems = await withStatus(data.problems, req.user, { contestId: contest._id });
    }

    res.status(200).json({ status: 'success', data: { contest: data } });
});

const createContest = catchAsync(async (req, res) => {
    const data = pick(req.body, ...EDITABLE);
    await validateProblems(data.problems);

    const contest = await Contest.create(data);

    res.status(201).json({ status: 'success', data: { contest } });
});

const updateContest = catchAsync(async (req, res, next) => {
    const contest = isObjectId(req.params.id) ? await Contest.findById(req.params.id) : null;
    if (!contest) return next(new AppError('No contest found with that ID.', 404));

    const data = pick(req.body, ...EDITABLE);
    if (statusOf(contest) !== 'upcoming' && (data.problems || data.startsAt)) {
        return next(new AppError('Problems and start time cannot change once a contest has started.', 400));
    }
    if (data.problems) await validateProblems(data.problems);

    contest.set(data);
    await contest.save();

    res.status(200).json({ status: 'success', data: { contest } });
});

const deleteContest = catchAsync(async (req, res, next) => {
    const contest = isObjectId(req.params.id) ? await Contest.findById(req.params.id) : null;
    if (!contest) return next(new AppError('No contest found with that ID.', 404));
    if (statusOf(contest) !== 'upcoming') {
        return next(new AppError('Only contests that have not started can be deleted.', 400));
    }

    await contest.deleteOne();

    res.status(204).send();
});

export { getAllContests, getContest, createContest, updateContest, deleteContest };