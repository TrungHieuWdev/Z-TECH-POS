import express from 'express';
import auth, { requireFullAccess } from '../middleware/auth.js';
import {
  getCategoryShare,
  getLowStock,
  getRecentOrders,
  getRevenueChart,
  getSummary,
  getTopProducts
} from '../controllers/dashboardController.js';

const router = express.Router();

router.get('/summary', auth, requireFullAccess, getSummary);
router.get('/revenue-chart', auth, requireFullAccess, getRevenueChart);
router.get('/top-products', auth, requireFullAccess, getTopProducts);
router.get('/low-stock', auth, requireFullAccess, getLowStock);
router.get('/category-share', auth, requireFullAccess, getCategoryShare);
router.get('/recent-orders', auth, requireFullAccess, getRecentOrders);

export default router;
