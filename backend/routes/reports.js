import express from 'express';
import auth, { requireFullAccess } from '../middleware/auth.js';
import { getSalesReport } from '../controllers/reportController.js';
import {
  getAiAnalysis, getCategories, getHourly, getPaymentMethods, getProducts,
  getSummary, getTrend, exportRevenue
} from '../controllers/revenueReportController.js';

const router = express.Router();

router.get('/sales', auth, requireFullAccess, getSalesReport);
router.get('/revenue/summary', auth, requireFullAccess, getSummary);
router.get('/revenue/trend', auth, requireFullAccess, getTrend);
router.get('/revenue/categories', auth, requireFullAccess, getCategories);
router.get('/revenue/payment-methods', auth, requireFullAccess, getPaymentMethods);
router.get('/revenue/hourly', auth, requireFullAccess, getHourly);
router.get('/revenue/products', auth, requireFullAccess, getProducts);
router.get('/revenue/ai-analysis', auth, requireFullAccess, getAiAnalysis);
router.get('/revenue/export', auth, requireFullAccess, exportRevenue);

export default router;
