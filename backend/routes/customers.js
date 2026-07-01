import express from 'express';
import auth, { requireFullAccess } from '../middleware/auth.js';
import { getAll, getById, getDetails, create, update, remove } from '../controllers/customerController.js';
import { validateCustomer } from '../middleware/validate.js';

const router = express.Router();

router.get('/', auth, getAll);
router.get('/:id/details', auth, getDetails);
router.get('/:id', auth, getById);
router.post('/', auth, validateCustomer, create);
router.put('/:id', auth, validateCustomer, update);
router.delete('/:id', auth, requireFullAccess, remove);

export default router;
