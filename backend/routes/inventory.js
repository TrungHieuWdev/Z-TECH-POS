import express from 'express';
import auth, { requireFullAccess } from '../middleware/auth.js';
import { getLogs, addStock, adjustStock } from '../controllers/inventoryController.js';

const router = express.Router();

router.get('/', auth, requireFullAccess, getLogs);
router.get('/logs', auth, requireFullAccess, getLogs);
router.post('/add', auth, requireFullAccess, addStock);
router.put('/adjust', auth, requireFullAccess, adjustStock);

export default router;
