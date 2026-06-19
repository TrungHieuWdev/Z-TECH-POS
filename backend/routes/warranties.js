import express from 'express';
import auth from '../middleware/auth.js';
import { getAll } from '../controllers/warrantyController.js';

const router = express.Router();

router.get('/', auth, getAll);

export default router;
