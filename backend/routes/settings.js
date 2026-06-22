import express from 'express';
import auth, { requireFullAccess } from '../middleware/auth.js';
import { getVatSettings, updateVatSettings } from '../controllers/settingsController.js';

const router = express.Router();
router.get('/vat', auth, getVatSettings);
router.put('/vat', auth, requireFullAccess, updateVatSettings);
export default router;
