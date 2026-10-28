import Submission from '../models/submissionModel.js';

export const withStatus = async (problems, user, match = {}) => {
    if (!user || !problems.length) return problems;

    const rows = await Submission.aggregate([
        { $match: { userId: user._id, problemId: { $in: problems.map((p) => p._id) }, ...match } },
        { $group: { _id: '$problemId', solved: { $max: { $eq: ['$status', 'ACCEPTED'] } } } },
    ]);
    const statuses = new Map(rows.map((row) => [String(row._id), row.solved ? 'solved' : 'tried']));
    return problems.map((problem) => ({ ...problem, status: statuses.get(String(problem._id)) ?? null }));
};
