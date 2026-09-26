import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Mở rộng interface Request để chứa object user
export interface AuthRequest extends Request {
  user?: {
    id: string;
    role?: string;
  };
  userId?: string;  // Giữ lại để tương thích nếu các controller cũ đang dùng
  userRole?: string;
}

export const verifyToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Cần đăng nhập để thực hiện chức năng này.' });
  }

  try {
    const decoded = jwt.verify(
      token, 
      process.env.JWT_SECRET || 'your_jwt_secret'
    ) as { id: string; role?: string };

    // Gán cả 2 kiểu để tương thích 100% với toàn bộ dự án
    req.user = { id: decoded.id, role: decoded.role };
    req.userId = decoded.id;
    req.userRole = decoded.role;

    next();
  } catch (error) {
    return res.status(403).json({ message: 'Token không hợp lệ hoặc đã hết hạn.' });
  }
};

// Export thêm alias 'authMiddleware' để khớp với câu lệnh import ở authRoutes.ts
export const authMiddleware = verifyToken;

/**
 * Middleware kiểm tra quyền Quản trị viên (Admin)
 */
export const isAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  const role = req.user?.role || req.userRole;
  if (role !== 'admin') {
    return res.status(403).json({ message: 'Bạn không có quyền truy cập. Yêu cầu quyền Admin.' });
  }
  next();
};