import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
}

export const verifyToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Cần đăng nhập để thực hiện chức năng này.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret') as { id: string; role?: string };
    req.userId = decoded.id; // Lưu userId vào Request object
    req.userRole = decoded.role; // Lưu userRole vào Request object
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Token không hợp lệ hoặc đã hết hạn.' });
  }
};

/**
 * Middleware kiểm tra quyền Quản trị viên (Admin)
 */
export const isAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ message: 'Bạn không có quyền truy cập. Yêu cầu quyền Admin.' });
  }
  next();
};