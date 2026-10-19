import Contest from '../models/contestModel.js';
import Submission from '../models/submissionModel.js';
import { redis } from './redis.js';

const WRONG_ATTEMPT_PENALTY_MIN = 20;
const SOLVED_WEIGHT = 1_000_000;

// score = solved * 1_000_000 - penaltyMinutes
const boardKey = (contestId) => `contest:${contestId}:board`;
const userKey = (contestId, userId) => `contest:${contestId}:u:${userId}`;

redis.defineCommand('applyVerdict', {
    numberOfKeys: 2,
    lua: `
        local pid = ARGV[1]
        if redis.call('HEXISTS', KEYS[1], pid .. ':ac') == 1 then return 0 end

        if ARGV[3] == 'AC' then
            local wrong = tonumber(redis.call('HGET', KEYS[1], pid .. ':wrong') or '0')
            local minutes = tonumber(ARGV[4])
            redis.call('HSET', KEYS[1], pid .. ':ac', minutes)
            redis.call('HINCRBY', KEYS[1], 'solved', 1)
            redis.call('HINCRBY', KEYS[1], 'penalty', minutes + ${WRONG_ATTEMPT_PENALTY_MIN} * wrong)
        else
            redis.call('HINCRBY', KEYS[1], pid .. ':wrong', 1)
        end

        local solved = tonumber(redis.call('HGET', KEYS[1], 'solved') or '0')
        local penalty = tonumber(redis.call('HGET', KEYS[1], 'penalty') or '0')
        redis.call('ZADD', KEYS[2], solved * ${SOLVED_WEIGHT} - penalty, ARGV[2])
        return 1
    `,
});

const IGNORED = new Set(['PENDING', 'RUNNING', 'COMPILE_ERROR']);

/**
 * Records one judged contest submission. Only the first ACCEPTED per problem counts, and
 * every wrong run before it adds 20 penalty minutes. `minutes` is the time since the contest start.
 */
export const applyVerdict = async ({ contestId, userId, problemId, verdict, minutes }) => {
    if (IGNORED.has(verdict)) return false;

    const applied = await redis.applyVerdict(
        userKey(contestId, userId),
        boardKey(contestId),
        String(problemId),
        String(userId),
        verdict === 'ACCEPTED' ? 'AC' : 'WA',
        Math.max(0, Math.floor(minutes)),
    );
    return applied === 1;
};

export const minutesSinceStart = (contest, submittedAt) =>
    (submittedAt - contest.startsAt) / 60000;

/**
 * Top `limit` users, best first:
 * [{ userId, score, solved, penaltyMinutes, problems: { [problemId]: { solved, wrong, minute } } }]
 */
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

export const rebuildLeaderboard = async (contestId) => {
    const contest = await Contest.findById(contestId).select('startsAt endsAt');
    if (!contest) return;

    const keys = await redis.keys(`contest:${contestId}:*`);
    if (keys.length) await redis.del(...keys);

    const cursor = Submission.find({
        contestId,
        status: { $nin: [...IGNORED] },
        submittedAt: { $gte: contest.startsAt, $lt: contest.endsAt },
    })
        .sort('submittedAt')
        .select('userId problemId status submittedAt')
        .cursor();

    for await (const s of cursor) {
        await applyVerdict({
            contestId,
            userId: s.userId,
            problemId: s.problemId,
            verdict: s.status,
            minutes: minutesSinceStart(contest, s.submittedAt),
        });
    }
};
