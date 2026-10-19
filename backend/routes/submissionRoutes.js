import express from 'express';
import rateLimit from 'express-rate-limit';
import { protect } from '../controllers/authController.js';
import {
    createSubmission,
    getSubmission,
    getMySubmissions,
} from '../controllers/submissionController.js';
import AppError from '../utils/appError.js';

const router = express.Router();

// 10 submissions a minute per user (by account)
const submitLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 10,
    keyGenerator: (req) => req.user.id,
    handler: (req, res, next) =>
        next(new AppError('Too many submissions. Please wait a minute.', 429)),
});

router.use(protect);

router.route('/').post(submitLimiter, createSubmission).get(getMySubmissions);
router.get('/:id', getSubmission);

export default router;
