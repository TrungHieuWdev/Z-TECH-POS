import express from 'express';
import { getByPublicToken } from '../controllers/publicWarrantyController.js';

const router = express.Router();
router.get('/:publicToken', getByPublicToken);
export default router;
