import cookieParser from 'cookie-parser';
import { Server } from 'socket.io';
import { identify } from '../controllers/authController.js';
import Contest from '../models/contestModel.js';
import Submission from '../models/submissionModel.js';
import { createRedis } from '../services/redis.js';
import { allowedOrigins } from '../utils/sameOrigin.js';
import isObjectId from '../utils/isObjectId.js';
import AppError from '../utils/appError.js';
import { isAdmin } from '../utils/roles.js';

const VERDICT_CHANNEL = 'verdicts';
const FINAL_STATUSES = ['ACCEPTED', 'WRONG_ANSWER', 'TLE', 'MLE', 'RUNTIME_ERROR', 'COMPILE_ERROR', 'SYSTEM_ERROR'];
const MAX_ROOMS_PER_SOCKET = 50;

const submissionRoom = (id) => `submission:${id}`;
const contestRoom = (id) => `contest:${id}`;

const guarded = (handler) => async (id, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    try {
        await handler(id, reply);
    } catch (err) {
        if (err.isOperational) return reply({ ok: false, message: err.message });

        console.log('Socket error:', err.message);
        reply({ ok: false, message: 'Something went wrong.' });
    }
};

export const initSockets = (httpServer) => {
    const io = new Server(httpServer, {
        cors: { origin: [...allowedOrigins], credentials: true },
        allowRequest: (req, callback) => {
            const origin = req.headers.origin;
            if (!origin || allowedOrigins.has(origin)) return callback(null, true);
            callback('Origin not allowed', false);
        },
    });

    io.engine.use(cookieParser());
    io.engine.use(identify);
    io.use((socket, next) => {
        if (!socket.request.user) return next(new AppError('Please log in.', 401));
        socket.data.user = socket.request.user;
        next();
    });

    io.on('connection', (socket) => {
        const user = socket.data.user;

        const joinRoom = (room) => {
            if (socket.rooms.size >= MAX_ROOMS_PER_SOCKET) {
                throw new AppError('Watching too many things at once.', 429);
            }
            socket.join(room);
        };

        socket.on(
            'submission:watch',
            guarded(async (id, reply) => {
                if (!isObjectId(id)) throw new AppError('Invalid submission ID.', 400);

                const submission = await Submission.findById(id).select(
                    'userId contestId problemId status compileOutput tests judgedAt',
                );
                const allowed =
                    submission && (isAdmin(user) || submission.userId.equals(user._id));
                if (!allowed) throw new AppError('No submission found with that ID.', 404);
                joinRoom(submissionRoom(id));

                reply({ ok: true, status: submission.status });

                if (FINAL_STATUSES.includes(submission.status)) {
                    socket.emit('submission:verdict', {
                        submissionId: submission.id,
                        userId: submission.userId,
                        contestId: submission.contestId,
                        problemId: submission.problemId,
                        status: submission.status,
                        compileOutput: submission.compileOutput,
                        tests: submission.tests,
                        judgedAt: submission.judgedAt,
                    });
                }
            }),
        );

        socket.on('submission:unwatch', (id) => {
            if (isObjectId(id)) socket.leave(submissionRoom(id));
        });

        socket.on(
            'contest:watch',
            guarded(async (id, reply) => {
                if (!isObjectId(id)) throw new AppError('Invalid contest ID.', 400);

                const contest = await Contest.findById(id).select('startsAt');
                if (!contest) throw new AppError('No contest found with that ID.', 404);
                if ((!contest.startsAt || contest.startsAt > new Date()) && !isAdmin(user)) {
                    throw new AppError('This contest has not started yet.', 403);
                }
                joinRoom(contestRoom(id));
                reply({ ok: true });
            }),
        );

        socket.on('contest:unwatch', (id) => {
            if (isObjectId(id)) socket.leave(contestRoom(id));
        });
    });

    const subscriber = createRedis();
    subscriber.subscribe(VERDICT_CHANNEL).catch((err) => {
        console.log('Could not subscribe to verdicts:', err.message);
    });
    subscriber.on('message', (channel, message) => {
        let verdict;
        try {
            verdict = JSON.parse(message);
        } catch {
            return console.log('Ignoring a malformed verdict message');
        }

        io.to(submissionRoom(verdict.submissionId)).emit('submission:verdict', verdict);

        if (verdict.contestId) {
            io.to(contestRoom(verdict.contestId)).emit('contest:update', {
                contestId: verdict.contestId,
            });
        }
    });

    return io;
};
