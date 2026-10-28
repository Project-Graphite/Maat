import express from 'express';
import { protect } from '../controllers/authController.js';
import {
    createSubmission,
    getSubmission,
    getMySubmissions,
} from '../controllers/submissionController.js';
import { submission as submitLimiter } from '../utils/rateLimits.js';

const router = express.Router();


router.use(protect);

router.route('/').post(submitLimiter, createSubmission).get(getMySubmissions);
router.get('/:id', getSubmission);

export default router;
