import express from 'express';
import multer from 'multer';
import auth from '../middleware/auth.js';
import { getAll, getById, create, update, remove, importImages } from '../controllers/productController.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

router.get('/', auth, getAll);
router.post('/import-images', auth, upload.single('file'), importImages);
router.get('/:id', auth, getById);
router.post('/', auth, create);
router.put('/:id', auth, update);
router.delete('/:id', auth, remove);

export default router;
