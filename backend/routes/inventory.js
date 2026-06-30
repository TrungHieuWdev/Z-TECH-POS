import express from 'express';
import auth, { requireFullAccess } from '../middleware/auth.js';
import { getLogs, addStock, adjustStock, getProductAIAnalysis, refreshProductAIAnalysis, getSalesOpportunities, generateAISalesOpportunities } from '../controllers/inventoryController.js';

const router = express.Router();

router.get('/', auth, getLogs);
router.get('/logs', auth, getLogs);
router.get('/product-ai-analysis', auth, getProductAIAnalysis);
router.post('/product-ai-analysis/refresh', auth, requireFullAccess, refreshProductAIAnalysis);
router.get('/sales-opportunities', auth, getSalesOpportunities);
router.post('/sales-opportunities/ai', auth, generateAISalesOpportunities);
router.post('/add', auth, requireFullAccess, addStock);
router.put('/adjust', auth, requireFullAccess, adjustStock);

export default router;
