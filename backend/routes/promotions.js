import express from 'express';
import auth, { requireFullAccess } from '../middleware/auth.js';
import { create, getAll, remove, update } from '../controllers/promotionController.js';
import { validatePromotion } from '../middleware/validate.js';

const router = express.Router();

router.get('/', auth, getAll);
router.post('/', auth, requireFullAccess, validatePromotion, create);
router.put('/:id', auth, requireFullAccess, validatePromotion, update);
router.delete('/:id', auth, requireFullAccess, remove);

export default router;
