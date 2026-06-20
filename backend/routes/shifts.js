import express from 'express';
import auth, { requireFullAccess } from '../middleware/auth.js';
import { getShifts, saveShifts } from '../controllers/shiftController.js';
const router = express.Router();
router.get('/', auth, getShifts);
router.put('/', auth, requireFullAccess, saveShifts);
export default router;
