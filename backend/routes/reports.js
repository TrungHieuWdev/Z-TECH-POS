import express from 'express';
import auth, { requireFullAccess } from '../middleware/auth.js';
import { getSalesReport } from '../controllers/reportController.js';
import {
  deleteAiAnalysisHistoryItem, exportRevenue, exportRevenueExcel, getAiAnalysis,
  getAiAnalysisHistory, getAiAnalysisHistoryItem, getCategories, getHourly,
  getCostReconciliation, getPaymentMethods, getProducts, getStockAlerts, getSummary, getTrend
} from '../controllers/revenueReportController.js';

const router = express.Router();

router.get('/sales', auth, requireFullAccess, getSalesReport);
router.get('/revenue/summary', auth, requireFullAccess, getSummary);
router.get('/revenue/trend', auth, requireFullAccess, getTrend);
router.get('/revenue/categories', auth, requireFullAccess, getCategories);
router.get('/revenue/payment-methods', auth, requireFullAccess, getPaymentMethods);
router.get('/revenue/hourly', auth, requireFullAccess, getHourly);
router.get('/revenue/stock-alerts', auth, requireFullAccess, getStockAlerts);
router.get('/revenue/products', auth, requireFullAccess, getProducts);
router.get('/revenue/cost-reconciliation', auth, requireFullAccess, getCostReconciliation);
router.get('/revenue/ai-analysis-history', auth, requireFullAccess, getAiAnalysisHistory);
router.get('/revenue/ai-analysis-history/:id', auth, requireFullAccess, getAiAnalysisHistoryItem);
router.delete('/revenue/ai-analysis-history/:id', auth, requireFullAccess, deleteAiAnalysisHistoryItem);
router.get('/revenue/ai-analysis', auth, requireFullAccess, getAiAnalysis);
router.get('/revenue/export-excel', auth, requireFullAccess, exportRevenueExcel);
router.get('/revenue/export', auth, requireFullAccess, exportRevenue);

export default router;
