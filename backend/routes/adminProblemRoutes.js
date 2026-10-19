import express from 'express';
import mongoSanitize from 'express-mongo-sanitize';
import { protect, restrictTo } from '../controllers/authController.js';
import {
    getAllProblemsAdmin,
    getProblemAdmin,
    createProblem,
    updateProblem,
    deleteProblem,
} from '../controllers/problemController.js';
import {
    getTestCases,
    createTestCase,
    createTestCases,
    updateTestCase,
    deleteTestCase,
} from '../controllers/testCaseController.js';

const router = express.Router();

router.use(protect, restrictTo('admin'));

router.route('/').get(getAllProblemsAdmin).post(createProblem);
router.route('/:id').get(getProblemAdmin).patch(updateProblem).delete(deleteProblem);

// Test data can be big, so app.js leaves these bodies unparsed. The large parser only runs
// here, after the admin check, so nobody else can make the server read 10mb.
// mongoSanitize runs again because the app-wide one ran before there was a body to clean.
router.use(
    '/:problemId/testcases',
    express.json({ limit: '10mb' }),
    mongoSanitize(),
);
router.route('/:problemId/testcases').get(getTestCases).post(createTestCase);
router.post('/:problemId/testcases/bulk', createTestCases);
router
    .route('/:problemId/testcases/:id')
    .patch(updateTestCase)
    .delete(deleteTestCase);

export default router;
