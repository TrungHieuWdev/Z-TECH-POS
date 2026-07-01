import express from 'express';
import auth, { requireFullAccess } from '../middleware/auth.js';
import { validatePurchaseOrder } from '../middleware/validate.js';
import { getAll, getById, create } from '../controllers/purchaseOrderController.js';
const router = express.Router();
router.get('/', auth, getAll);
router.get('/:id', auth, getById);
router.post('/', auth, requireFullAccess, validatePurchaseOrder, create);
export default router;
