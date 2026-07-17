import express from 'express';
import auth, { requireFullAccess } from '../middleware/auth.js';
import { getAll } from '../controllers/paymentController.js';
import asyncHandler from '../middleware/asyncHandler.js';
const router = express.Router();
router.get('/', auth, requireFullAccess, asyncHandler(getAll));
export default router;
