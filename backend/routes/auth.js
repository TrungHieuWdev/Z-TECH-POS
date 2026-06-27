import express from 'express';
import auth from '../middleware/auth.js';
import { changePassword, login, getMe } from '../controllers/authController.js';

const router = express.Router();

router.post('/login', login);
router.get('/me', auth, getMe);
router.put('/change-password', auth, changePassword);

export default router;
