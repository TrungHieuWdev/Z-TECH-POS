import express from 'express';
import auth, { requireFullAccess } from '../middleware/auth.js';
import { getSalesReport } from '../controllers/reportController.js';

const router = express.Router();

router.get('/sales', auth, requireFullAccess, getSalesReport);

export default router;
