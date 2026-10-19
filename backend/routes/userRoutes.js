import express from 'express';
import { protect, restrictTo } from '../controllers/authController.js';
import {
    getMe,
    updateMe,
    uploadAvatar,
    deleteAvatar,
    getAvatar,
    getAllUsers,
    updateUserRole,
} from '../controllers/userController.js';
import { AVATAR_MAX_BYTES, AVATAR_TYPES } from '../utils/storage.js';

const router = express.Router();

router.get('/:id/avatar', getAvatar);
router.use(protect);
router.get('/me', getMe);
router.patch('/me', updateMe);

router.put(
    '/me/avatar',
    express.raw({ type: Object.keys(AVATAR_TYPES), limit: AVATAR_MAX_BYTES }),
    uploadAvatar,
);
router.delete('/me/avatar', deleteAvatar);

router.use(restrictTo('admin'));

router.get('/', getAllUsers);
router.patch('/:id/role', updateUserRole);

export default router;