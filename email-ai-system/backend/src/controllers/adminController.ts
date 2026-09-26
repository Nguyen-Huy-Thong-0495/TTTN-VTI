import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import User from '../models/User';
import Email from '../models/Email'; 

// Lấy danh sách toàn bộ người dùng
export const getUsers = async (req: AuthRequest, res: Response) => {
  try {
    const users = await User.find().select('-password');
    return res.status(200).json({ success: true, data: users });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi lấy danh sách người dùng', error });
  }
};

// Cấp quyền Admin hoặc giáng quyền xuống User
export const updateUserRole = async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { role } = req.body; // 'admin' hoặc 'user'

    const updatedUser = await User.findByIdAndUpdate(userId, { role }, { new: true }).select('-password');
    return res.status(200).json({ success: true, message: 'Cập nhật quyền thành công', data: updatedUser });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi cập nhật quyền', error });
  }
};

// Tăng / giảm giới hạn Token sử dụng
export const updateTokenLimit = async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { tokenLimit } = req.body;

    const updatedUser = await User.findByIdAndUpdate(userId, { tokenLimit }, { new: true }).select('-password');
    return res.status(200).json({ success: true, message: 'Cập nhật hạn mức Token thành công', data: updatedUser });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi cập nhật Token Limit', error });
  }
};

// Thống kê tổng quan hệ thống (Email & Token)
export const getSystemStats = async (req: AuthRequest, res: Response) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalEmails = await Email.countDocuments();
    const processedEmails = await Email.countDocuments({ status: 'Resolved' });
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
    return res.status(500).json({ success: false, message: 'Lỗi lấy thống kê hệ thống', error });
  }
};