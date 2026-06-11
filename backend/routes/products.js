import express from 'express';
import multer from 'multer';
import auth, { requireFullAccess } from '../middleware/auth.js';
import { getAll, getById, create, update, remove, importImages } from '../controllers/productController.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

router.get('/', auth, getAll);
router.post('/import-images', auth, requireFullAccess, upload.single('file'), importImages);
router.get('/:id', auth, getById);
router.post('/', auth, requireFullAccess, create);
router.put('/:id', auth, requireFullAccess, update);
router.delete('/:id', auth, requireFullAccess, remove);

export default router;
