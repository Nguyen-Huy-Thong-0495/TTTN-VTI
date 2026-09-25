import { api } from './api';

export interface SystemStats {
  totalUsers: number;
  totalEmails: number;
  processedEmails: number;
  totalTokensUsed: number;
}

export interface AdminUser {
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  tokenLimit: number;
  tokensUsed: number;
  createdAt: string;
}

/**
 * Lấy thống kê tổng quan hệ thống
 */
export const getSystemStats = async (): Promise<SystemStats> => {
  const response = await api.get('/admin/stats');
  return response.data.data;
};

/**
 * Lấy danh sách toàn bộ người dùng
 */
export const getUsers = async (): Promise<AdminUser[]> => {
  const response = await api.get('/admin/users');
  return response.data.data;
};

/**
 * Cập nhật vai trò người dùng (admin/user)
 */
export const updateUserRole = async (userId: string, role: 'admin' | 'user'): Promise<AdminUser> => {
  const response = await api.patch(`/admin/users/${userId}/role`, { role });
  return response.data.data;
};

/**
 * Cập nhật hạn mức Token của người dùng
 */
export const updateTokenLimit = async (userId: string, tokenLimit: number): Promise<AdminUser> => {
  const response = await api.patch(`/admin/users/${userId}/token-limit`, { tokenLimit });
  return response.data.data;
};