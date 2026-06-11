import express from 'express';
import auth from '../middleware/auth.js';
import { getActivityLogs } from '../controllers/activityLogController.js';

const router = express.Router();

router.get('/', auth, getActivityLogs);

export default router;
