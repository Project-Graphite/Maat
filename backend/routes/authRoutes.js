import express from 'express';
import {
    signup,
    login,
    logout,
    identify,
    protect,
    forgotPassword,
    resetPassword,
    updatePassword,
} from '../controllers/authController.js';
import * as limits from '../utils/rateLimits.js';

const router = express.Router();

router.post('/signup', limits.signup, signup);
router.post('/login', limits.login, login);
router.post('/logout', identify, logout);
router.post('/forgot-password', limits.forgotPassword, forgotPassword);
router.patch('/reset-password/:token', limits.resetPassword, resetPassword);
router.patch('/update-password', protect, limits.passwordCheck, updatePassword);

export default router;
