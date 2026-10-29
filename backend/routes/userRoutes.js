import express from 'express';
import { deactivateAccount, protect, restrictTo } from '../controllers/authController.js';
import {
    getMe,
    getMyStats,
    updateMe,
    uploadAvatar,
    deleteAvatar,
    getAvatar,
    getAllUsers,
    updateUserRole,
    deleteUser,
} from '../controllers/userController.js';
import { AVATAR_MAX_BYTES, AVATAR_TYPES } from '../utils/storage.js';
import * as limits from '../utils/rateLimits.js';

const router = express.Router();

router.get('/:id/avatar', getAvatar);
router.use(protect);
router.get('/me', getMe);
router.get('/me/stats', getMyStats);
router.patch('/me', updateMe);
router.delete('/me', limits.passwordCheck, deactivateAccount);

router.put(
    '/me/avatar',
    limits.avatar,
    express.raw({ type: AVATAR_TYPES, limit: AVATAR_MAX_BYTES }),
    uploadAvatar,
);
router.delete('/me/avatar', deleteAvatar);

router.use(restrictTo('admin'));

router.get('/', getAllUsers);
router.patch('/:id/role', updateUserRole);
router.delete('/:id', deleteUser);

export default router;