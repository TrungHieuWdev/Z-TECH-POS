import express from 'express';
import auth, { requireFullAccess } from '../middleware/auth.js';
import {
  createEmployee,
  deleteEmployee,
  getAllEmployees,
  getEmployeeRevenue,
  resetEmployeePassword,
  toggleEmployeeStatus,
  updateEmployee
} from '../controllers/employeeController.js';
import { validateEmployee } from '../middleware/validate.js';

const router = express.Router();

router.get('/', auth, requireFullAccess, getAllEmployees);
router.get('/revenue', auth, requireFullAccess, getEmployeeRevenue);
router.post('/', auth, requireFullAccess, validateEmployee, createEmployee);
router.put('/:id', auth, requireFullAccess, validateEmployee, updateEmployee);
router.delete('/:id', auth, requireFullAccess, deleteEmployee);
router.post('/:id/reset-password', auth, requireFullAccess, resetEmployeePassword);
router.post('/:id/toggle-status', auth, requireFullAccess, toggleEmployeeStatus);

export default router;
