import React, { useState, useEffect } from 'react';
import Login from './components/Login'; 
import { Dashboard } from './pages/dashboard/Dashboard';
import { AdminDashboard } from './pages/dashboard/AdminDashboard';

export const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<string>('user');

  // Hàm kiểm tra trạng thái đăng nhập và vai trò
  const checkAuth = () => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (token) {
      setIsAuthenticated(true);
      if (storedUser) {
        try {
          const userObj = JSON.parse(storedUser);
          setUserRole(userObj.role || 'user');
        } catch (e) {
          setUserRole('user');
        }
      }
    } else {
      setIsAuthenticated(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('role');
    setIsAuthenticated(false);
    setUserRole('user');
  };

  if (!isAuthenticated) {
    return <Login />; // ✅ Đã loại bỏ prop onLoginSuccess vì dùng Google OAuth redirect trực tiếp
  }

  return (
    <div>
      {/* Nút Đăng xuất ở góc giao diện */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        <span className="text-xs text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700/60">
          Quyền: <strong className={userRole === 'admin' ? 'text-amber-400' : 'text-blue-400'}>{userRole.toUpperCase()}</strong>
        </span>
        <button
          onClick={handleLogout}
          className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg transition-colors cursor-pointer"
        >
          Đăng xuất
        </button>
      </div>

      {/* Hiển thị Dashboard theo Vai trò */}
      {userRole === 'admin' ? <AdminDashboard /> : <Dashboard />}
    </div>
  );
};

export default App;