import { Router } from 'express';
import { getUsers, updateUserRole, updateTokenLimit, getSystemStats } from '../controllers/adminController';
import { verifyToken, isAdmin } from '../middleware/authMiddleware';

const router = Router();

// Bắt buộc tất cả API admin phải qua kiểm tra verifyToken và isAdmin
router.use(verifyToken, isAdmin);

router.get('/users', getUsers);
router.patch('/users/:userId/role', updateUserRole);
router.patch('/users/:userId/token-limit', updateTokenLimit);
router.get('/stats', getSystemStats);

export default router;