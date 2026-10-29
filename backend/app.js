import express from 'express';
import mongoose from 'mongoose';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoSanitize from 'express-mongo-sanitize';
import cookieParser from 'cookie-parser';
import { filterXSS } from 'xss';
import AppError from './utils/appError.js';
import errorController from './controllers/errorController.js';
import sameOrigin from './utils/sameOrigin.js';
import * as limits from './utils/rateLimits.js';
import { redis } from './services/redis.js';
import { judgeQueue } from './services/queue.js';
import authRouter from './routes/authRoutes.js';
import userRouter from './routes/userRoutes.js';
import problemRouter from './routes/problemRoutes.js';
import solutionRouter from './routes/solutionRoutes.js';
import adminProblemRouter from './routes/adminProblemRoutes.js';
import submissionRouter from './routes/submissionRoutes.js';
import contestRouter from './routes/contestRoutes.js';
import { getProblemSitemap } from './controllers/sitemapController.js';

const XSS_SKIP_FIELDS = new Set([
    'password',
    'passwordConfirm',
    'passwordCurrent',
    'sourceCode',
    'statementMd',
    'input',
    'expectedOutput',
]);

const sanitize = (value) => {
    if (typeof value === 'string') return filterXSS(value);
    if (Array.isArray(value)) return value.map(sanitize);
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value).map(([key, val]) => [
                key,
                XSS_SKIP_FIELDS.has(key) ? val : sanitize(val),
            ]),
        );
    }
    return value;
};

const app = express();
app.set('trust proxy', 1);
app.use(helmet());

app.get('/health', async (req, res) => {
    const mongo = mongoose.connection.readyState === 1;
    const redisUp = redis.status === 'ready';
    const workers = redisUp ? await judgeQueue.getWorkersCount().catch(() => 0) : 0;
    res.status(mongo && redisUp ? 200 : 503).json({
        status: mongo && redisUp ? 'ok' : 'degraded',
        mongo: mongo ? 'up' : 'down',
        redis: redisUp ? 'up' : 'down',
        workers,
    });
});

app.get('/sitemap-problems.xml', getProblemSitemap);

morgan.token('url', (req) => req.originalUrl.replace(/(\/reset-password\/)[^/?]+/, '$1[redacted]'));
if (process.env.NODE_ENV !== 'test') {
    app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined'));
}

app.use('/api', limits.global);

const defaultJson = express.json({ limit: '10kb' });
const jsonByRoute = [
    [/^\/api\/v1\/submissions\/?$/, express.json({ limit: '100kb' })],
    [/^\/api\/v1\/admin\/problems(\/[a-f0-9]{24})?\/?$/i, express.json({ limit: '200kb' })],
];

const TEST_CASE_ROUTE = /^\/api\/v1\/admin\/problems\/[a-f0-9]{24}\/testcases(\/|$)/i;

app.use((req, res, next) => {
    if (TEST_CASE_ROUTE.test(req.path)) return next();
    const route = jsonByRoute.find(([pattern]) => pattern.test(req.path));
    (route ? route[1] : defaultJson)(req, res, next);
});

app.use(cookieParser());

app.use(mongoSanitize());

app.use((req, res, next) => {
    if (req.body) req.body = sanitize(req.body);
    next();
});

app.use('/api', sameOrigin);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/problems', problemRouter);
app.use('/api/v1/solutions', solutionRouter);
app.use('/api/v1/admin/problems', adminProblemRouter);
app.use('/api/v1/submissions', submissionRouter);
app.use('/api/v1/contests', contestRouter);

app.all('*', (req, res, next) => {
    next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(errorController);

export default app;