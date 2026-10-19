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

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.post('/logout', identify, logout);
router.post('/forgot-password', forgotPassword);
router.patch('/reset-password/:token', resetPassword);
router.patch('/update-password', protect, updatePassword);

export default router;
