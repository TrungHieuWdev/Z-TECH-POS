import express from 'express';
import auth, { requireFullAccess } from '../middleware/auth.js';
import {
  createEmployee,
  getAllEmployees,
  resetEmployeePassword,
  toggleEmployeeStatus,
  updateEmployee
} from '../controllers/employeeController.js';

const router = express.Router();

router.get('/', auth, requireFullAccess, getAllEmployees);
router.post('/', auth, requireFullAccess, createEmployee);
router.put('/:id', auth, requireFullAccess, updateEmployee);
router.post('/:id/reset-password', auth, requireFullAccess, resetEmployeePassword);
router.post('/:id/toggle-status', auth, requireFullAccess, toggleEmployeeStatus);

export default router;
