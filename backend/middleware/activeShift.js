import { hasFullAccess } from './auth.js';
import { hasActiveShift } from '../services/shiftService.js';

export default async function requireActiveShift(req, res, next) {
  try {
    if (hasFullAccess(req.user) || await hasActiveShift(req.user)) {
      return next();
    }
    return res.status(403).json({ message: 'Ca làm việc đã đóng hoặc chưa được bắt đầu' });
  } catch (error) {
    return next(error);
  }
}

