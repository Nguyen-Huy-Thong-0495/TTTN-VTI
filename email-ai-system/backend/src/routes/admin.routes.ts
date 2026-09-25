import { Router } from 'express';
import { getUsers, updateUserRole, updateTokenLimit, getSystemStats } from '../controllers/admin.controller';
import { verifyToken, isAdmin } from '../middleware/auth.middleware';

const router = Router();

// Bắt buộc phải có Token và đúng quyền Admin
router.use(verifyToken, isAdmin);

router.get('/users', getUsers);
router.patch('/users/:userId/role', updateUserRole);
router.patch('/users/:userId/token-limit', updateTokenLimit);
router.get('/stats', getSystemStats);

export default router;