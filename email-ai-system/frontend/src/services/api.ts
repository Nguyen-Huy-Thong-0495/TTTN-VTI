import axios from 'axios';

// Khởi tạo instance Axios
// Dùng đường dẫn tương đối '/api' vì Frontend và Backend chạy chung trên Port 3000
export const api = axios.create({
    baseURL: '/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

// 1. Tự động đính kèm Token vào Header trước khi gửi Request
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// 2. Tự động xử lý nếu Token hết hạn hoặc không hợp lệ (Lỗi 401)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            console.warn('Phiên đăng nhập đã hết hạn!');
            // Xóa sạch thông tin xác thực lưu trong Storage
            localStorage.removeItem('token');
            localStorage.removeItem('role');
            localStorage.removeItem('user');

            // Điều hướng về trang đăng nhập nếu chưa ở trang login
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);