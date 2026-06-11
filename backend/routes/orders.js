import express from 'express';
import auth, { requireFullAccess } from '../middleware/auth.js';
import { create, getAll, getById, update, remove } from '../controllers/orderController.js';

const router = express.Router();

router.get('/', auth, getAll);
router.get('/:id', auth, getById);
router.post('/', auth, create);
router.put('/:id', auth, requireFullAccess, update);
router.delete('/:id', auth, requireFullAccess, remove);

export default router;
