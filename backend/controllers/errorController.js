import AppError from '../utils/appError.js';

const handleCastErrorDB = (err) => {
	const message = `Invalid ${err.path}: ${err.value}.`;
	return new AppError(message, 400);
};

const handleDuplicateFieldsDB = (err) => {
	const value = err.keyValue
		? JSON.stringify(err.keyValue)
		: 'duplicate value';
	const message = `Duplicate field value: ${value}. Please use another value!`;
	return new AppError(message, 400);
};

const handleValidationErrorDB = (err) => {
	const errors = Object.values(err.errors).map((el) => el.message);
	const message = `Invalid input data.${errors.join('. ')}`;
	return new AppError(message, 400);
};

const handleJWTError = (err) => {
	const message = `Invalid token. Please log in again!`;
	return new AppError(message, 401);
};

const handleTokenExpiredError = (err) => {
	const message = `Your token has expired! Please log in again.`;
	return new AppError(message, 401);
};

const handleMulterError = (err) => {
	const message = `File upload error: ${err.message}`;
	return new AppError(message, 400);
};

const handleTooLarge = () => {
	const message = `Request body is too large.`;
	return new AppError(message, 413);
};

const sendDevError = (err, res) => {
	res.status(err.statusCode).json({
		status: err.status,
		err: err,
		message: err.message,
		stack: err.stack,
	});
};

const sendProdError = (err, res) => {
	if (err.isOperational) {
		res.status(err.statusCode).json({
			status: err.status,
			message: err.message,
		});
	} else {
		console.error('Error 💥', err);
		res.status(500).json({
			status: 'error',
			message: 'Something went very wrong!',
		});
	}
};

export default (err, req, res, next) => {
	if (res.headersSent) return next(err);

	err.statusCode = err.statusCode || 500;
	err.status = err.status || 'error';

	let error = err;
	if (err.name === 'CastError') error = handleCastErrorDB(err);
	if (err.code === 11000) error = handleDuplicateFieldsDB(err);
	if (err.name === 'ValidationError') error = handleValidationErrorDB(err);
	if (err.name === 'JsonWebTokenError') error = handleJWTError();
	if (err.name === 'TokenExpiredError') error = handleTokenExpiredError();
	if (err.name === 'MulterError') error = handleMulterError(err);
	if (err.type === 'entity.too.large') error = handleTooLarge();

	if (process.env.NODE_ENV === 'production') {
		sendProdError(error, res);
	} else {
		sendDevError(error, res);
	}
};
