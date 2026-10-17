import Contest from '../models/contestModel.js';
import User from '../models/userModel.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/appError.js';
import isObjectId from '../utils/isObjectId.js';
import { getStandings as readStandings } from '../services/leaderboard.js';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

const getStandings = catchAsync(async (req, res, next) => {
    const contest = isObjectId(req.params.id)
        ? await Contest.findById(req.params.id).select('startsAt')
        : null;
    if (!contest) return next(new AppError('No contest found with that ID.', 404));

    if (contest.startsAt > new Date() && (!req.user || req.user.role !== 'admin')) {
        return next(new AppError('This contest has not started yet.', 403));
    }

    const requested = parseInt(req.query.limit, 10);
    const limit =
        Number.isInteger(requested) && requested > 0
            ? Math.min(requested, MAX_LIMIT)
            : DEFAULT_LIMIT;

    const rows = await readStandings(contest._id.toString(), limit);

    const users = await User.find({ _id: { $in: rows.map((r) => r.userId) } }).select('name');
    const names = new Map(users.map((u) => [u.id, u.name]));

    const standings = rows.map((row, i) => ({
        rank: i + 1,
        ...row,
        name: names.get(String(row.userId)) || 'Unknown',
    }));

    res.status(200).json({
        status: 'success',
        results: standings.length,
        data: { standings },
    });
});

export { getStandings };
