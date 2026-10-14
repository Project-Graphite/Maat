import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import { filterXSS } from 'xss';
import AppError from './utils/appError.js';
import errorController from './controllers/errorController.js';

const XSS_SKIP_FIELDS = new Set(['password', 'passwordConfirm', 'passwordCurrent']);

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

// Body parser, reading data from body into req.body
app.use(express.json({ limit: '10kb' }));

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

// Handle unhandled routes
app.all('*', (req, res, next) => {
    next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global error handling middleware
app.use(errorController);

export default app;