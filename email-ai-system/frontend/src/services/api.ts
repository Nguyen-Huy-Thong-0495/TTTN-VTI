import axios from 'axios';

export const api = axios.create({
    baseURL: 'http://localhost:5000/api',
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
            console.warn('Phiên đăng nhập hết hạn!');
            localStorage.removeItem('token');

        }
        return Promise.reject(error);
    }
);