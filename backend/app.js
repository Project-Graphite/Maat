import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import mongoose from 'mongoose';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import cookieParser from 'cookie-parser';
import { filterXSS } from 'xss';
import AppError from './utils/appError.js';
import errorController from './controllers/errorController.js';
import sameOrigin from './utils/sameOrigin.js';
import { redis } from './services/redis.js';
import authRouter from './routes/authRoutes.js';
import userRouter from './routes/userRoutes.js';
import problemRouter from './routes/problemRoutes.js';
import adminProblemRouter from './routes/adminProblemRoutes.js';
import submissionRouter from './routes/submissionRoutes.js';
import contestRouter from './routes/contestRoutes.js';

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
/////////////// 1) MIDDLEWARES /////////////////////////
// Set security HTTP headers
app.use(helmet());

app.get('/health', (req, res) => {
    const mongo = mongoose.connection.readyState === 1;
    const redisUp = redis.status === 'ready';
    res.status(mongo && redisUp ? 200 : 503).json({
        status: mongo && redisUp ? 'ok' : 'degraded',
        mongo: mongo ? 'up' : 'down',
        redis: redisUp ? 'up' : 'down',
    });
});

// Development logging
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// Limit requests from same API
const limiter = rateLimit({
    max: 100,
    windowMs: 60 * 60 * 1000,
    message: 'Too many requests from this IP, please try again in an hour!',
});
app.use('/api', limiter);

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

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Data sanitization against XSS
app.use((req, res, next) => {
    if (req.body) req.body = sanitize(req.body);
    next();
});

// Serving static files
app.use(express.static(`${path.dirname(fileURLToPath(import.meta.url))}/public`));

// Mounting routers
app.use('/api', sameOrigin);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/problems', problemRouter);
app.use('/api/v1/admin/problems', adminProblemRouter);
app.use('/api/v1/submissions', submissionRouter);
app.use('/api/v1/contests', contestRouter);

// Handle unhandled routes
app.all('*', (req, res, next) => {
    next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global error handling middleware
app.use(errorController);

export default app;