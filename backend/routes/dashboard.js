import express from 'express';
import auth from '../middleware/auth.js';
import {
  getCategoryShare,
  getLowStock,
  getRecentOrders,
  getRevenueChart,
  getSummary,
  getTopProducts
} from '../controllers/dashboardController.js';

const router = express.Router();

router.get('/summary', auth, getSummary);
router.get('/revenue-chart', auth, getRevenueChart);
router.get('/top-products', auth, getTopProducts);
router.get('/low-stock', auth, getLowStock);
router.get('/category-share', auth, getCategoryShare);
router.get('/recent-orders', auth, getRecentOrders);

export default router;
