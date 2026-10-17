import Problem from '../models/problemModel.js';
import TestCase from '../models/testCaseModel.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/appError.js';
import pick from '../utils/pick.js';

const MAX_FIELD_BYTES = 1024 * 1024;
const MAX_BULK = 100;
const FIELDS = ['input', 'expectedOutput', 'isSample'];
const WITH_DATA = '+input +expectedOutput';

const assertProblemExists = async (problemId) => {
	if (!(await Problem.exists({ _id: problemId }))) {
		throw new AppError('No problem found with that ID.', 404);
	}
};

const validateData = (data) => {
	for (const field of ['input', 'expectedOutput']) {
		const value = data[field];
		if (value === undefined) continue;
		if (typeof value !== 'string')
			throw new AppError(`${field} must be a string.`, 400);
		if (Buffer.byteLength(value) > MAX_FIELD_BYTES) {
			throw new AppError(`${field} must be 1MB or smaller.`, 400);
		}
	}
	if (data.isSample !== undefined && typeof data.isSample !== 'boolean') {
		throw new AppError('isSample must be true or false.', 400);
	}
};

const lastOrdinal = async (problemId) => {
	const last = await TestCase.findOne({ problemId })
		.sort('-ordinal')
		.select('ordinal');
	return last ? last.ordinal : 0;
};

const getTestCases = catchAsync(async (req, res) => {
	await assertProblemExists(req.params.problemId);

	const testCases = await TestCase.find({ problemId: req.params.problemId })
		.select(WITH_DATA)
		.sort('ordinal');

	res.status(200).json({
		status: 'success',
		results: testCases.length,
		data: { testCases },
	});
});

const createTestCase = catchAsync(async (req, res) => {
	const { problemId } = req.params;
	await assertProblemExists(problemId);

	const data = pick(req.body, ...FIELDS, 'ordinal');
	validateData(data);
	if (data.ordinal === undefined)
		data.ordinal = (await lastOrdinal(problemId)) + 1;

	const testCase = await TestCase.create({ ...data, problemId });

	res.status(201).json({ status: 'success', data: { testCase } });
});

const createTestCases = catchAsync(async (req, res, next) => {
	const { problemId } = req.params;
	const { testCases } = req.body;

	if (
		!Array.isArray(testCases) ||
		testCases.length === 0 ||
		testCases.length > MAX_BULK
	) {
		return next(
			new AppError(`Provide between 1 and ${MAX_BULK} test cases.`, 400),
		);
	}
	await assertProblemExists(problemId);

	const start = await lastOrdinal(problemId);
	const docs = testCases.map((item, i) => {
		const data = pick(item, ...FIELDS);
		validateData(data);
		return { ...data, problemId, ordinal: start + i + 1 };
	});

	const created = await TestCase.insertMany(docs);

	res.status(201).json({
		status: 'success',
		results: created.length,
		data: { testCases: created },
	});
});

const updateTestCase = catchAsync(async (req, res, next) => {
	const testCase = await TestCase.findOne({
		_id: req.params.id,
		problemId: req.params.problemId,
	}).select(WITH_DATA);
	if (!testCase)
		return next(new AppError('No test case found with that ID.', 404));

	const data = pick(req.body, ...FIELDS, 'ordinal');
	validateData(data);
	testCase.set(data);
	await testCase.save();

	res.status(200).json({ status: 'success', data: { testCase } });
});

const deleteTestCase = catchAsync(async (req, res, next) => {
	const testCase = await TestCase.findOneAndDelete({
		_id: req.params.id,
		problemId: req.params.problemId,
	});
	if (!testCase)
		return next(new AppError('No test case found with that ID.', 404));

	res.status(204).send();
});

export {
	getTestCases,
	createTestCase,
	createTestCases,
	updateTestCase,
	deleteTestCase,
};
