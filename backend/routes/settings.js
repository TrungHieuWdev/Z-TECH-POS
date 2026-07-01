import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
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

const router = express.Router();

const uploadDir = path.resolve('uploads/settings');
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename(req, file, callback) {
      const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
      callback(null, `shop-logo-${Date.now()}${ext}`);
    }
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter(req, file, callback) {
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.mimetype)) {
      return callback(new Error('Logo chỉ hỗ trợ PNG, JPG, WEBP hoặc SVG'));
    }
    return callback(null, true);
  }
});

router.get('/', auth, getSettings);
router.put('/', auth, requireFullAccess, validateSettings, updateSettings);
router.post('/logo', auth, requireFullAccess, upload.single('logo'), uploadShopLogo);
router.get('/vat', auth, getVatSettings);
router.put('/vat', auth, requireFullAccess, validateSettings, updateVatSettings);
router.get('/bank-transfer', auth, getBankTransferSettings);
router.put('/bank-transfer', auth, requireFullAccess, validateSettings, updateBankTransferSettings);
export default router;
