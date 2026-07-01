import express from 'express';
import auth from '../middleware/auth.js';
import { getAll, getClaims, createClaim, updateClaim } from '../controllers/warrantyController.js';
import { requireFullAccess } from '../middleware/auth.js';
import { validateWarrantyClaim } from '../middleware/validate.js';

const router = express.Router();

router.get('/', auth, getAll);
router.get('/:orderItemId/claims', auth, getClaims);
router.post('/:orderItemId/claims', auth, requireFullAccess, validateWarrantyClaim, createClaim);
router.put('/claims/:claimId', auth, requireFullAccess, updateClaim);

export default router;
