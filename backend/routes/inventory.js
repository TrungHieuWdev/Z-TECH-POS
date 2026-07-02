import express from 'express';
import auth, { requireFullAccess } from '../middleware/auth.js';
import { getLogs, addStock, adjustStock } from '../controllers/inventoryController.js';
import { getInventoryRestockSuggestions } from '../controllers/aiController.js';
import { validateStockQuantity } from '../middleware/validate.js';

const router = express.Router();

router.get('/', auth, getLogs);
router.get('/logs', auth, getLogs);
router.get('/restock-suggestions', auth, requireFullAccess, getInventoryRestockSuggestions);
router.post('/add', auth, requireFullAccess, validateStockQuantity, addStock);
router.put('/adjust', auth, requireFullAccess, validateStockQuantity, adjustStock);

export default router;
