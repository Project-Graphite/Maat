import { redis } from './redis.js';

// Write side of the backend's leaderboard service. The Lua script and the key names must
// stay identical to backend/services/leaderboard.js, because both sides use the same data.
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
