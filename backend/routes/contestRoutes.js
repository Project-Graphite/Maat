import express from 'express';
import { identify, protect, restrictTo } from '../controllers/authController.js';
import {
    getAllContests,
    getContest,
    createContest,
    updateContest,
    deleteContest,
} from '../controllers/contestController.js';
import { getStandings } from '../controllers/leaderboardController.js';

const router = express.Router();

router.get('/', getAllContests);

router.get('/:id', identify, getContest);
router.get('/:id/standings', identify, getStandings);

router.use(protect, restrictTo('admin'));

router.post('/', createContest);
router.route('/:id').patch(updateContest).delete(deleteContest);

export default router;
