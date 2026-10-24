import AppError from './appError.js';

// Refuses requests that change data when they come from another website. Browsers always
// send Origin on these; requests without one (API tools) still need a valid login.
const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

// Origins come from FRONTEND_URL (comma-separated for several), never from request headers,
// so a proxy header can't be faked to get past the check
export const allowedOrigins = new Set(
    (process.env.FRONTEND_URL || '')
        .split(',')
        .map((url) => url.trim())
        .filter(Boolean)
        .map((url) => new URL(url).origin),
);

export default (req, res, next) => {
    if (SAFE_METHODS.includes(req.method)) return next();

    const origin = req.get('origin');
    if (!origin) return next();

    if (!allowedOrigins.has(origin)) {
        return next(new AppError('Request blocked: it came from another website.', 403));
    }
    next();
};
