import Submission from '../models/submissionModel.js';
import User from '../models/userModel.js';
import { removeAvatar } from '../utils/storage.js';
import { removeFromLeaderboard } from './leaderboard.js';

const GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const deleteAccount = async (user) => {
    const contestIds = await Submission.distinct('contestId', { userId: user._id, contestId: { $ne: null } });
    await Promise.all(contestIds.map((contestId) => removeFromLeaderboard(contestId, user._id)));
    if (user.photo) await removeAvatar(user.photo);
    await Submission.deleteMany({ userId: user._id });
    await user.deleteOne();
};

export const purgeDeactivatedAccounts = async (now = Date.now()) => {
    const users = await User.find({ deactivatedAt: { $lte: new Date(now - GRACE_PERIOD_MS) } }).select('photo');
    for (const user of users) await deleteAccount(user);
    return users.length;
};

export const scheduleAccountCleanup = () => {
    const run = () =>
        purgeDeactivatedAccounts()
            .then((count) => count && console.log(`Deleted ${count} deactivated account(s)`))
            .catch((err) => console.log('Account cleanup failed:', err.message));
    run();
    setInterval(run, DAY_MS).unref();
};
