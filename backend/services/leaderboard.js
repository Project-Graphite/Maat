import { redis } from './redis.js';

const boardKey = (contestId) => `contest:${contestId}:board`;
const userKey = (contestId, userId) => `contest:${contestId}:u:${userId}`;

export const getStandings = async (contestId, limit = 50) => {
    const top = await redis.zrevrange(boardKey(contestId), 0, limit - 1, 'WITHSCORES');

    const rows = [];
    for (let i = 0; i < top.length; i += 2) rows.push({ userId: top[i], score: Number(top[i + 1]) });

    const hashes = await Promise.all(rows.map((row) => redis.hgetall(userKey(contestId, row.userId))));

    return rows.map((row, i) => {
        const hash = hashes[i];
        const problems = {};
        for (const [field, value] of Object.entries(hash)) {
            const [problemId, kind] = field.split(':');
            if (!kind) continue;
            problems[problemId] ??= { solved: false, wrong: 0, minute: null };
            if (kind === 'wrong') problems[problemId].wrong = Number(value);
            if (kind === 'ac') {
                problems[problemId].solved = true;
                problems[problemId].minute = Number(value);
            }
        }
        return {
            ...row,
            solved: Number(hash.solved || 0),
            penaltyMinutes: Number(hash.penalty || 0),
            problems,
        };
    });
};

export const removeFromLeaderboard = (contestId, userId) =>
    Promise.all([redis.del(userKey(contestId, userId)), redis.zrem(boardKey(contestId), String(userId))]);

export const clearLeaderboard = async (contestId) => {
    const userIds = await redis.zrange(boardKey(contestId), 0, -1);
    await redis.del(boardKey(contestId), ...userIds.map((userId) => userKey(contestId, userId)));
};
