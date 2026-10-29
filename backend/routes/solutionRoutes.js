import express from 'express';
import { identify } from '../controllers/authController.js';
import { getSolution } from '../controllers/problemController.js';

const router = express.Router();

router.get('/:id', identify, getSolution);

export default router;
