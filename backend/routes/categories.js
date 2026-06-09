import express from 'express';
import auth from '../middleware/auth.js';
import { getAll, create, update, remove } from '../controllers/categoryController.js';

const router = express.Router();

router.get('/', auth, getAll);
router.post('/', auth, create);
router.put('/:id', auth, update);
router.delete('/:id', auth, remove);

export default router;
