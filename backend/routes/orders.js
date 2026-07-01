import express from 'express';
import auth, { requireFullAccess } from '../middleware/auth.js';
import { create, getAll, getById, update, remove } from '../controllers/orderController.js';
import { validateCreateOrder, validateUpdateOrder } from '../middleware/validate.js';

const router = express.Router();

router.get('/', auth, getAll);
router.get('/:id', auth, getById);
router.post('/', auth, validateCreateOrder, create);
router.put('/:id', auth, requireFullAccess, validateUpdateOrder, update);
router.delete('/:id', auth, requireFullAccess, remove);

export default router;
