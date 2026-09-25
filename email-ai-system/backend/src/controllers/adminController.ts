import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import User from '../models/User';
import Email from '../models/Email'; 

/**
 * Lấy danh sách toàn bộ tài khoản người dùng
 */
export const getUsers = async (req: AuthRequest, res: Response) => {
  try {
    const users = await User.find().select('-password');
    return res.status(200).json({ success: true, data: users });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi máy chủ khi lấy danh sách người dùng', error });
  }
};

/**
 * Cấp quyền Admin hoặc đổi lại quyền User
 */
export const updateUserRole = async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!['admin', 'user'].includes(role)) {
      return res.status(400).json({ message: 'Vai trò không hợp lệ (chỉ chọn admin hoặc user).' });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { role },
      { new: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
    }

    return res.status(200).json({ message: 'Cập nhật quyền thành công!', data: updatedUser });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi máy chủ khi cập nhật quyền', error });
  }
};

/**
 * Điều chỉnh hạn mức Token cho người dùng
 */
export const updateTokenLimit = async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { tokenLimit } = req.body;

    if (typeof tokenLimit !== 'number' || tokenLimit < 0) {
      return res.status(400).json({ message: 'Hạn mức token phải là số lớn hơn hoặc bằng 0.' });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { tokenLimit },
      { new: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
    }

    return res.status(200).json({ message: 'Cập nhật hạn mức token thành công!', data: updatedUser });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi máy chủ khi cập nhật hạn mức token', error });
  }
};

/**
 * Thống kê tổng quan hệ thống (User, Email, Token)
 */
export const getSystemStats = async (req: AuthRequest, res: Response) => {
  try {
    const totalUsers = await User.countDocuments();

    let totalEmails = 0;
    let processedEmails = 0;
    try {
      totalEmails = await Email.countDocuments();
      // Sửa 'PROCESSED' thành 'Resolved' để khớp với Enum trong Email Model
      processedEmails = await Email.countDocuments({ status: 'Resolved' });
    } catch (e) {
      // Bỏ qua nếu có lỗi kết nối
    }

    const tokenStats = await User.aggregate([
      { $group: { _id: null, totalTokensUsed: { $sum: '$tokensUsed' } } }
    ]);

    return res.status(200).json({
      success: true,
      data: {
        totalUsers,
        totalEmails,
        processedEmails,
        totalTokensUsed: tokenStats[0]?.totalTokensUsed || 0
      }
    });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi máy chủ khi lấy thống kê hệ thống', error });
  }
};