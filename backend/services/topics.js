import Contest from '../models/contestModel.js';

export const problemsInUnendedContests = (problemIds) =>
    Contest.distinct('problems.problemId', {
        endsAt: { $gt: new Date() },
        ...(problemIds && { 'problems.problemId': { $in: problemIds } }),
    });

export const withTopics = async (problems, hidden) => {
    hidden ??= await problemsInUnendedContests(problems.map((p) => p._id));
    return problems.map((problem) =>
        hidden.some((id) => id.equals(problem._id)) ? { ...problem, topics: [] } : problem,
    );
};
