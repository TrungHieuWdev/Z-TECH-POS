import express from 'express';
import multer from 'multer';
import auth, { requireFullAccess } from '../middleware/auth.js';
import { getAll, getById, scan, create, update, remove, importImages, importProducts } from '../controllers/productController.js';
import { imageUploadFilter, validateProduct } from '../middleware/validate.js';
import { verifyImageUpload } from '../security/imageUpload.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageUploadFilter
});

router.get('/', auth, getAll);
router.post(
  '/import-images',
  auth,
  requireFullAccess,
  upload.single('file'),
  verifyImageUpload,
  importImages
);
router.post('/import', auth, requireFullAccess, importProducts);
router.get('/barcode/:barcode', auth, scan);
router.get('/scan/:barcode', auth, scan);
router.get('/:id', auth, getById);
router.post('/', auth, requireFullAccess, validateProduct, create);
router.put('/:id', auth, requireFullAccess, validateProduct, update);
router.delete('/:id', auth, requireFullAccess, remove);

export default router;
