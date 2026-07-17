import express from 'express';
import auth, { requireFullAccess } from '../middleware/auth.js';
import { getAll, getById, update, remove } from '../controllers/orderController.js';
import { create } from '../controllers/orderCreateController.js';
import { validateCreateOrder, validateUpdateOrder } from '../middleware/validate.js';
import requireActiveShift from '../middleware/activeShift.js';

const router = express.Router();

router.get('/', auth, getAll);
router.get('/:id', auth, getById);
router.post('/', auth, requireActiveShift, validateCreateOrder, create);
router.put('/:id', auth, requireFullAccess, validateUpdateOrder, update);
router.delete('/:id', auth, requireFullAccess, remove);

export default router;
