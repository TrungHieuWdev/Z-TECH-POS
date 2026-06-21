import express from 'express';
import auth, { requireFullAccess } from '../middleware/auth.js';
import {
  createEmployee,
  deleteEmployee,
  getAllEmployees,
  resetEmployeePassword,
  toggleEmployeeStatus,
  updateEmployee
} from '../controllers/employeeController.js';

const router = express.Router();

router.get('/', auth, requireFullAccess, getAllEmployees);
router.post('/', auth, requireFullAccess, createEmployee);
router.put('/:id', auth, requireFullAccess, updateEmployee);
router.delete('/:id', auth, requireFullAccess, deleteEmployee);
router.post('/:id/reset-password', auth, requireFullAccess, resetEmployeePassword);
router.post('/:id/toggle-status', auth, requireFullAccess, toggleEmployeeStatus);

export default router;
