import express from 'express';
import auth, { requireFullAccess } from '../middleware/auth.js';
import { getAll, create, update, updateVisibility, remove } from '../controllers/categoryController.js';

const router = express.Router();

router.get('/', auth, getAll);
router.post('/', auth, requireFullAccess, create);
router.put('/:id', auth, requireFullAccess, update);
router.patch('/:id/visibility', auth, requireFullAccess, updateVisibility);
router.delete('/:id', auth, requireFullAccess, remove);

export default router;
