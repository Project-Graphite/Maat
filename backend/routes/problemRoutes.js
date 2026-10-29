import express from 'express';
import { identify } from '../controllers/authController.js';
import { getAllProblems, getProblem, getSolutions } from '../controllers/problemController.js';

const router = express.Router();

router.get('/', identify, getAllProblems);

router.get('/:slug', identify, getProblem);
router.get('/:slug/solutions', identify, getSolutions);

export default router;
