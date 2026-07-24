import express from 'express';
import multer from 'multer';
import auth, { requireFullAccess } from '../middleware/auth.js';
import {
  getBankTransferSettings,
  getSettings,
  getVatSettings,
  updateSettings,
  updateBankTransferSettings,
  updateVatSettings,
  uploadShopLogo
} from '../controllers/settingsController.js';
import { validateSettings } from '../middleware/validate.js';
import { verifyImageUpload } from '../security/imageUpload.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter(req, file, callback) {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype)) {
      return callback(new Error('Logo chỉ hỗ trợ PNG, JPG hoặc WEBP'));
    }
    return callback(null, true);
  }
});

router.get('/', auth, getSettings);
router.put('/', auth, requireFullAccess, validateSettings, updateSettings);
router.post(
  '/logo',
  auth,
  requireFullAccess,
  upload.single('logo'),
  verifyImageUpload,
  uploadShopLogo
);
router.get('/vat', auth, getVatSettings);
router.put('/vat', auth, requireFullAccess, validateSettings, updateVatSettings);
router.get('/bank-transfer', auth, getBankTransferSettings);
router.put('/bank-transfer', auth, requireFullAccess, validateSettings, updateBankTransferSettings);
export default router;
