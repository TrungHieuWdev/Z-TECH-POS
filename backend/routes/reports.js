import express from 'express';
import auth from '../middleware/auth.js';
import { getSalesReport } from '../controllers/reportController.js';

const router = express.Router();

router.get('/sales', auth, getSalesReport);

export default router;
