import express from 'express';
import { protect } from '../controllers/authController.js';
import {
    createSubmission,
    runCode,
    updateSubmission,
    getSubmission,
    getSubmissionTest,
    getMySubmissions,
} from '../controllers/submissionController.js';
import * as limits from '../utils/rateLimits.js';

const router = express.Router();

router.use(protect);

router.route('/').post(limits.submission, createSubmission).get(getMySubmissions);
router.post('/run', limits.run, runCode);
router.route('/:id').get(getSubmission).patch(updateSubmission);
router.get('/:id/tests/:ordinal', getSubmissionTest);

export default router;
