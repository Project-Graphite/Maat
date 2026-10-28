import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import AppError from './appError.js';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

const byIp = (req) => ipKeyGenerator(req.ip);
const byAccount = (req) => req.user.id;

const limiter = ({ windowMs, limit, keyGenerator = byIp, message, skipSuccessfulRequests = false }) =>
    rateLimit({
        windowMs,
        limit,
        keyGenerator,
        skipSuccessfulRequests,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        handler: (req, res, next) => next(new AppError(message, 429)),
    });

export const global = limiter({
    windowMs: HOUR,
    limit: Number(process.env.API_RATE_LIMIT) || 1000,
    message: 'Too many requests from this network. Please try again in an hour.',
});

export const signup = limiter({
    windowMs: HOUR,
    limit: 20,
    message: 'Too many accounts created from this network. Please try again later.',
});

export const login = limiter({
    windowMs: 15 * MINUTE,
    limit: 10,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => `${byIp(req)}:${String(req.body?.email).toLowerCase()}`,
    message: 'Too many failed logins. Please wait 15 minutes and try again.',
});

export const forgotPassword = limiter({
    windowMs: HOUR,
    limit: 5,
    message: 'Too many reset requests. Please try again in an hour.',
});

export const resetPassword = limiter({
    windowMs: 15 * MINUTE,
    limit: 10,
    message: 'Too many attempts. Please wait 15 minutes and try again.',
});

export const passwordCheck = limiter({
    windowMs: 15 * MINUTE,
    limit: 10,
    keyGenerator: byAccount,
    message: 'Too many attempts. Please wait 15 minutes and try again.',
});

export const submission = limiter({
    windowMs: MINUTE,
    limit: 10,
    keyGenerator: byAccount,
    message: 'Too many submissions. Please wait a minute.',
});

export const avatar = limiter({
    windowMs: HOUR,
    limit: 20,
    keyGenerator: byAccount,
    message: 'Too many photo uploads. Please try again in an hour.',
});
