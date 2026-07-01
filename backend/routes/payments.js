import express from 'express';
import auth, { requireFullAccess } from '../middleware/auth.js';
import { getAll } from '../controllers/paymentController.js';
const router = express.Router();
router.get('/', auth, requireFullAccess, getAll);
export default router;
