import express from 'express';
import auth, { requireFullAccess } from '../middleware/auth.js';
import {
  getBankTransferSettings,
  getVatSettings,
  updateBankTransferSettings,
  updateVatSettings
} from '../controllers/settingsController.js';

const router = express.Router();
router.get('/vat', auth, getVatSettings);
router.put('/vat', auth, requireFullAccess, updateVatSettings);
router.get('/bank-transfer', auth, getBankTransferSettings);
router.put('/bank-transfer', auth, requireFullAccess, updateBankTransferSettings);
export default router;
