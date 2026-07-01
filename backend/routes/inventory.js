import express from 'express';
import auth, { requireFullAccess } from '../middleware/auth.js';
import { getLogs, addStock, adjustStock } from '../controllers/inventoryController.js';
import { getProductAIAnalysis, refreshProductAIAnalysis, getSalesOpportunities, generateAISalesOpportunities } from '../controllers/aiController.js';
import { validateStockQuantity } from '../middleware/validate.js';

const router = express.Router();

router.get('/', auth, getLogs);
router.get('/logs', auth, getLogs);
router.get('/product-ai-analysis', auth, getProductAIAnalysis);
router.post('/product-ai-analysis/refresh', auth, requireFullAccess, refreshProductAIAnalysis);
router.get('/sales-opportunities', auth, getSalesOpportunities);
router.post('/sales-opportunities/ai', auth, generateAISalesOpportunities);
router.post('/add', auth, requireFullAccess, validateStockQuantity, addStock);
router.put('/adjust', auth, requireFullAccess, validateStockQuantity, adjustStock);

export default router;
