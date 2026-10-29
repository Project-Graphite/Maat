import Contest from '../models/contestModel.js';
import Problem from '../models/problemModel.js';

const MINUTE_MS = 60 * 1000;

// Each ended contest is handled once, so a problem an admin hides again afterwards stays hidden.
// A problem that is also in a contest that has not ended yet waits for that one.
export const publishEndedContests = async (now = new Date()) => {
    const contests = await Contest.find({ endsAt: { $lte: now }, problemsPublished: { $ne: true } }).select('problems');
    if (!contests.length) return 0;

    const problemIds = contests.flatMap((contest) => contest.problems.map((p) => p.problemId));
    const pending = await Contest.distinct('problems.problemId', {
        'problems.problemId': { $in: problemIds },
        endsAt: { $gt: now },
    });
    const ready = problemIds.filter((id) => !pending.some((other) => other.equals(id)));

    const { modifiedCount } = await Problem.updateMany({ _id: { $in: ready }, visible: false }, { visible: true });
    await Contest.updateMany({ _id: { $in: contests.map((c) => c._id) } }, { problemsPublished: true });
    return modifiedCount;
};

export const scheduleContestPublishing = () => {
    const run = () =>
        publishEndedContests()
            .then((count) => count && console.log(`Added ${count} contest problem(s) to the problem set`))
            .catch((err) => console.log('Publishing contest problems failed:', err.message));
    run();
    setInterval(run, MINUTE_MS).unref();
};
