import Problem from '../models/problemModel.js';
import Submission from '../models/submissionModel.js';
import User from '../models/userModel.js';
import APIFeatures from '../utils/apiFeatures.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/appError.js';
import isObjectId from '../utils/isObjectId.js';
import { putAvatar, removeAvatar, sendAvatar } from '../utils/storage.js';
import { deleteAccount } from '../services/accountCleanup.js';

// Who may manage whom: admins can delete regular users, the super admin also manages admins and is
// the only one who changes roles. Nobody manages a super admin or themselves here, and the super
// admin role is never handed out
const ASSIGNABLE_ROLES = ['user', 'admin'];
const findManageable = async (req) => {
	const target = isObjectId(req.params.id) ? await User.findById(req.params.id) : null;
	if (!target) throw new AppError('No user found with that ID.', 404);
	if (target.id === req.user.id) throw new AppError('You cannot do this to your own account.', 400);
	const allowed = target.role === 'user' || (target.role === 'admin' && req.user.role === 'superadmin');
	if (!allowed) throw new AppError('Only the super admin can manage other admins.', 403);
	return target;
};

const getMe = catchAsync(async (req, res) => {
	res.status(200).json({ status: 'success', data: { user: req.user } });
});

const DIFFICULTIES = Problem.schema.path('difficulty').enumValues;

const getMyStats = catchAsync(async (req, res) => {
	const userId = req.user._id;
	const [attempts, problemCounts, languages, recent] = await Promise.all([
		Submission.aggregate([
			{ $match: { userId } },
			{ $group: { _id: '$problemId', solved: { $max: { $eq: ['$status', 'ACCEPTED'] } } } },
		]),
		Problem.aggregate([{ $match: { visible: true } }, { $group: { _id: '$difficulty', count: { $sum: 1 } } }]),
		Submission.aggregate([
			{ $match: { userId } },
			{
				$group: {
					_id: '$language',
					count: { $sum: 1 },
					accepted: { $sum: { $cond: [{ $eq: ['$status', 'ACCEPTED'] }, 1, 0] } },
				},
			},
			{ $sort: { count: -1 } },
		]),
		Submission.find({ userId })
			.sort('-submittedAt')
			.limit(5)
			.select('problemId language status submittedAt')
			.populate('problemId', 'slug title'),
	]);

	// Only problems in the problem set count towards progress
	const attempted = await Problem.find({ _id: { $in: attempts.map((a) => a._id) }, visible: true }).select('difficulty');
	const solvedIds = new Set(attempts.filter((a) => a.solved).map((a) => String(a._id)));
	const progress = Object.fromEntries(DIFFICULTIES.map((level) => [level, { solved: 0, total: 0 }]));
	for (const { _id, count } of problemCounts) progress[_id].total = count;
	for (const problem of attempted) {
		if (solvedIds.has(problem.id)) progress[problem.difficulty].solved++;
	}
	const solved = Object.values(progress).reduce((sum, p) => sum + p.solved, 0);

	res.status(200).json({
		status: 'success',
		data: {
			stats: {
				memberSince: userId.getTimestamp(),
				solved,
				total: Object.values(progress).reduce((sum, p) => sum + p.total, 0),
				tried: attempted.length - solved,
				progress,
				submissions: languages.reduce((sum, l) => sum + l.count, 0),
				accepted: languages.reduce((sum, l) => sum + l.accepted, 0),
				languages: languages.map(({ _id, count }) => ({ language: _id, count })),
				recent,
			},
		},
	});
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
	if (req.user.photo) await removeAvatar(req.user.photo);

	res.status(200).json({ status: 'success', data: { user } });
});

const deleteAvatar = catchAsync(async (req, res) => {
	if (req.user.photo) await removeAvatar(req.user.photo);
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
	if (req.user.role !== 'superadmin') {
		return next(new AppError('Only the super admin can change roles.', 403));
	}
	if (!ASSIGNABLE_ROLES.includes(req.body.role)) {
		return next(new AppError(`Role must be one of: ${ASSIGNABLE_ROLES.join(', ')}.`, 400));
	}
	const user = await findManageable(req);
	user.role = req.body.role;
	await user.save({ validateBeforeSave: false });

	res.status(200).json({ status: 'success', data: { user } });
});

const deleteUser = catchAsync(async (req, res) => {
	await deleteAccount(await findManageable(req));
	res.status(204).send();
});

export {
	getMe,
	getMyStats,
	updateMe,
	uploadAvatar,
	deleteAvatar,
	getAvatar,
	getAllUsers,
	updateUserRole,
	deleteUser,
};
