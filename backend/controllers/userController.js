import User from '../models/userModel.js';
import APIFeatures from '../utils/apiFeatures.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/appError.js';
import isObjectId from '../utils/isObjectId.js';
import { putAvatar, removeAvatar, sendAvatar } from '../utils/storage.js';

const ROLES = User.schema.path('role').enumValues;

const getMe = catchAsync(async (req, res) => {
	res.status(200).json({ status: 'success', data: { user: req.user } });
});

const updateMe = catchAsync(async (req, res, next) => {
	if (typeof req.body.name !== 'string') {
		return next(new AppError('Please provide a name.', 400));
	}

	const user = await User.findByIdAndUpdate(
		req.user._id,
		{ name: req.body.name },
		{ new: true, runValidators: true },
	);

	res.status(200).json({ status: 'success', data: { user } });
});

const uploadAvatar = catchAsync(async (req, res, next) => {
	if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
		return next(new AppError('No image uploaded.', 400));
	}

	const key = await putAvatar(req.user.id, req.body);
	const user = await User.findByIdAndUpdate(
		req.user._id,
		{ photo: key },
		{ new: true },
	);

	res.status(200).json({ status: 'success', data: { user } });
});

const deleteAvatar = catchAsync(async (req, res) => {
	await removeAvatar(req.user.id);
	await User.updateOne({ _id: req.user._id }, { $unset: { photo: 1 } });

	res.status(204).send();
});

const getAvatar = catchAsync(async (req, res, next) => {
	const user = isObjectId(req.params.id)
		? await User.findById(req.params.id).select('photo')
		: null;
	if (!user || !user.photo)
		return next(new AppError('No avatar found.', 404));

	await sendAvatar(user.photo, res);
});

const getAllUsers = catchAsync(async (req, res) => {
	const features = new APIFeatures(
		User.find().select('name email role photo'),
		req.query,
		{
			searchable: 'name',
			sortable: ['name', 'role'],
			defaultSort: 'name',
			defaultLimit: 20,
			maxLimit: 100,
		},
	)
		.search()
		.sort()
		.paginate();

	const [users, total] = await Promise.all([
		features.query,
		User.countDocuments(features.conditions),
	]);

	res.status(200).json({
		status: 'success',
		results: users.length,
		total,
		page: features.page,
		data: { users },
	});
});

const updateUserRole = catchAsync(async (req, res, next) => {
	if (!ROLES.includes(req.body.role)) {
		return next(
			new AppError(`Role must be one of: ${ROLES.join(', ')}.`, 400),
		);
	}
	if (req.params.id === req.user.id) {
		return next(new AppError('You cannot change your own role.', 400));
	}

	const user = await User.findByIdAndUpdate(
		req.params.id,
		{ role: req.body.role },
		{ new: true, runValidators: true },
	);
	if (!user) return next(new AppError('No user found with that ID.', 404));

	res.status(200).json({ status: 'success', data: { user } });
});

export {
	getMe,
	updateMe,
	uploadAvatar,
	deleteAvatar,
	getAvatar,
	getAllUsers,
	updateUserRole,
};
