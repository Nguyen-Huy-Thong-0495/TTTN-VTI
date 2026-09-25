import React, { useState, useEffect } from 'react';
import { getSystemStats, getUsers, updateUserRole, updateTokenLimit, SystemStats, AdminUser } from '../../services/admin.service';
import { Dashboard } from './Dashboard';

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'stats' | 'users' | 'emails'>('stats');
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [statsData, usersData] = await Promise.all([
        getSystemStats(),
        getUsers()
      ]);
      setStats(statsData);
      setUsers(usersData);
    } catch (err: any) {
      showNotice(err.response?.data?.message || 'Không thể tải dữ liệu quản trị', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showNotice = (text: string, type: 'success' | 'error') => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 3000);
  };

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'user') => {
    try {
      await updateUserRole(userId, newRole);
      showNotice('Cập nhật quyền thành công!', 'success');
      loadAdminData();
    } catch (err: any) {
      showNotice(err.response?.data?.message || 'Lỗi khi đổi quyền', 'error');
    }
  };

  const handleTokenLimitChange = async (userId: string, newLimit: number) => {
    if (isNaN(newLimit) || newLimit < 0) return;
    try {
      await updateTokenLimit(userId, newLimit);
      showNotice('Cập nhật hạn mức Token thành công!', 'success');
      loadAdminData();
    } catch (err: any) {
      showNotice(err.response?.data?.message || 'Lỗi khi chỉnh token limit', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      {/* Header */}
      <div className="mb-6 border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <span>🛡️</span> Bảng Quản Trị Hệ Thống (Admin Dashboard)
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Quản lý người dùng, phân quyền, cấp phát hạn mức Token và theo dõi thống kê hệ thống.
        </p>
      </div>

      {/* Thông báo Alert */}
      {msg && (
        <div className={`mb-4 px-4 py-2.5 rounded-lg text-xs font-medium border ${
          msg.type === 'success' ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300' : 'bg-rose-950/80 border-rose-700 text-rose-300'
        }`}>
          {msg.text}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex gap-2 border-b border-slate-800 mb-6">
        <button
          onClick={() => setActiveTab('stats')}
          className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === 'stats'
              ? 'border-amber-400 text-amber-400 bg-slate-900/50'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          📊 Thống kê Hệ thống
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === 'users'
              ? 'border-amber-400 text-amber-400 bg-slate-900/50'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          👥 Quản lý Tài khoản & Token
        </button>
        <button
          onClick={() => setActiveTab('emails')}
          className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === 'emails'
              ? 'border-amber-400 text-amber-400 bg-slate-900/50'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          ✉️ Giao diện Xử lý Email người dùng
        </button>
      </div>

      {/* TAB 1: THỐNG KÊ HỆ THỐNG */}
      {activeTab === 'stats' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
            <span className="text-xs text-slate-400 block mb-1">Tổng Người Dùng</span>
            <span className="text-2xl font-bold text-blue-400">{stats?.totalUsers || 0}</span>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
            <span className="text-xs text-slate-400 block mb-1">Tổng Email Tiếp Nhận</span>
            <span className="text-2xl font-bold text-slate-200">{stats?.totalEmails || 0}</span>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
            <span className="text-xs text-slate-400 block mb-1">Email Đã Xử Lý / Phản Hồi</span>
            <span className="text-2xl font-bold text-emerald-400">{stats?.processedEmails || 0}</span>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
            <span className="text-xs text-slate-400 block mb-1">Tổng Token AI Đã Dùng</span>
            <span className="text-2xl font-bold text-amber-400">{stats?.totalTokensUsed?.toLocaleString() || 0}</span>
          </div>
        </div>
      )}

      {/* TAB 2: QUẢN LÝ TÀI KHOẢN & TOKEN */}
      {activeTab === 'users' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-800/60 text-slate-400 uppercase border-b border-slate-800">
                <tr>
                  <th className="p-3">Họ Tên</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Vai Trò (Role)</th>
                  <th className="p-3">Hạn Mức Token</th>
                  <th className="p-3">Đã Sử Dụng</th>
                  <th className="p-3">Tỷ Lệ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {users.map((u) => {
                  const percent = u.tokenLimit > 0 ? Math.min(100, Math.round((u.tokensUsed / u.tokenLimit) * 100)) : 0;
                  return (
                    <tr key={u._id} className="hover:bg-slate-800/30">
                      <td className="p-3 font-medium text-slate-200">{u.name}</td>
                      <td className="p-3 text-slate-400">{u.email}</td>
                      <td className="p-3">
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u._id, e.target.value as 'admin' | 'user')}
                          className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td className="p-3">
                        <input
                          type="number"
                          defaultValue={u.tokenLimit}
                          onBlur={(e) => handleTokenLimitChange(u._id, parseInt(e.target.value))}
                          className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs w-28 text-slate-200 focus:outline-none focus:border-amber-400"
                        />
                      </td>
                      <td className="p-3 text-amber-400/90 font-mono">{u.tokensUsed.toLocaleString()}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${percent >= 90 ? 'bg-rose-500' : percent >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                              style={{ width: `${percent}%` }}
                            ></div>
                          </div>
                          <span className="text-[10px] text-slate-400">{percent}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: GIAO DIỆN XỬ LÝ EMAIL */}
      {activeTab === 'emails' && (
        <div className="mt-2 border border-slate-800 rounded-xl overflow-hidden">
          <Dashboard />
        </div>
      )}
    </div>
  );
};