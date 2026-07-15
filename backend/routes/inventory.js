import express from 'express';
import auth, { requireFullAccess } from '../middleware/auth.js';
import { getLogs, addStock, adjustStock } from '../controllers/inventoryController.js';
import { validateStockQuantity } from '../middleware/validate.js';

const router = express.Router();

router.get('/', auth, getLogs);
router.get('/logs', auth, getLogs);
router.post('/add', auth, requireFullAccess, validateStockQuantity, addStock);
router.put('/adjust', auth, requireFullAccess, validateStockQuantity, adjustStock);

export default router;
