import express from 'express';
import auth, { requireFullAccess } from '../middleware/auth.js';
import { getActivityLogs } from '../controllers/activityLogController.js';

const router = express.Router();

router.get('/', auth, requireFullAccess, getActivityLogs);

export default router;
