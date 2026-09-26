import { Router } from 'express';
import { 
  register, 
  login, 
  updateEmailConfig, 
  getEmailConfig, 
  disconnectEmail,
  googleAuth,        // <--- Thêm hàm này
  googleAuthCallback // <--- Thêm hàm này
} from '../controllers/authController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();    

// Public routes
router.post('/register', register);
router.post('/login', login);

// --- ROUTE GOOGLE OAUTH2 ---
router.get('/google', googleAuth);                  // Bấm nút đăng nhập sẽ gọi vào đây
router.get('/google/callback', googleAuthCallback); // Google trả kết quả về đây
// ---------------------------

// Protected routes (Cần truyền JWT Token trong Header: Authorization: Bearer <token>)
router.get('/email-config', authMiddleware, getEmailConfig);
router.post('/email-config', authMiddleware, updateEmailConfig);
router.post('/email-disconnect', authMiddleware, disconnectEmail);

export default router;