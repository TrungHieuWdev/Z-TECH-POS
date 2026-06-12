import express from 'express';
import auth from '../middleware/auth.js';
import { getLogs, addStock, adjustStock } from '../controllers/inventoryController.js';

const router = express.Router();

router.get('/', auth, getLogs);
router.get('/logs', auth, getLogs);
router.post('/add', auth, addStock);
router.put('/adjust', auth, adjustStock);

export default router;
