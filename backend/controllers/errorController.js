import AppError from '../utils/appError.js';

const DUPLICATE_MESSAGES = {
	email: 'An account with this email already exists.',
	name: 'That name is already taken.',
	slug: 'Another problem already uses that address.',
};

const toAppError = (err) => {
	if (err.name === 'CastError') return new AppError(`Invalid ${err.path}: ${err.value}.`, 400);
	if (err.code === 11000) {
		const field = Object.keys(err.keyValue || {})[0];
		return new AppError(DUPLICATE_MESSAGES[field] || 'That value is already taken.', 400);
	}
	if (err.name === 'ValidationError') {
		return new AppError(Object.values(err.errors).map((el) => el.message).join(' '), 400);
	}
	if (err.name === 'JsonWebTokenError') return new AppError('Your session is not valid. Please log in again.', 401);
	if (err.name === 'TokenExpiredError') return new AppError('Your session has expired. Please log in again.', 401);
	if (err.type === 'entity.too.large') return new AppError('The request is too large.', 413);
	return err;
};

export default (err, req, res, next) => {
	if (res.headersSent) return next(err);

	const error = toAppError(err);
	const statusCode = error.statusCode || 500;

	if (process.env.NODE_ENV !== 'production') {
		return res.status(statusCode).json({ status: error.status || 'error', message: error.message, stack: error.stack });
	}
	if (error.isOperational) {
		return res.status(statusCode).json({ status: error.status, message: error.message });
	}
	console.error('Unexpected error:', err);
	res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
};