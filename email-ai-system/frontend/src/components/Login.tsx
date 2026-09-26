import React, { useEffect } from 'react';

const Login: React.FC = () => {
    // Tự động bắt token từ URL khi Google Redirect về
    useEffect(() => {
        const queryParams = new URLSearchParams(window.location.search);
        const token = queryParams.get('token');
        const userStr = queryParams.get('user'); // Nếu backend có truyền kèm thông tin user

        if (token) {
            localStorage.setItem('token', token);
            if (userStr) {
                localStorage.setItem('user', userStr);
            }
            // Load lại trang hoặc chuyển hướng để App.tsx nhận diện đã đăng nhập
            window.location.href = '/';
        }
    }, []);

    // Hàm xử lý khi bấm nút Đăng nhập với Google
    const handleGoogleLogin = () => {
        window.location.href = 'http://localhost:3000/api/auth/google';
    };

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            backgroundColor: '#0f172a',
            fontFamily: 'sans-serif'
        }}>
            <div style={{
                backgroundColor: '#1e293b',
                padding: '40px',
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
                width: '100%',
                maxWidth: '400px',
                textAlign: 'center'
            }}>
                <div style={{ marginBottom: '24px' }}>
                    <h2 style={{ color: '#f8fafc', marginBottom: '8px', fontSize: '24px' }}>
                        AI Email Smart Agent
                    </h2>
                    <p style={{ color: '#94a3b8', fontSize: '14px' }}>
                        Đăng nhập để quản lý và phân loại hòm thư thông minh
                    </p>
                </div>

                <button
                    onClick={handleGoogleLogin}
                    style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px',
                        backgroundColor: '#ffffff',
                        color: '#1e293b',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '12px 16px',
                        fontSize: '16px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                    onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                        <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.95H1.19v3.14C3.17 21.36 7.23 24 12 24z"/>
                        <path fill="#FBBC05" d="M5.28 14.25c-.25-.72-.38-1.49-.38-2.25s.13-1.53.38-2.25V6.61H1.19C.43 8.13 0 9.87 0 12s.43 3.87 1.19 5.39l4.09-3.14z"/>
                        <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.23 0 3.17 2.64 1.19 6.61l4.09 3.14c.95-2.84 3.6-4.95 6.72-4.95z"/>
                    </svg>
                    Đăng nhập với Google
                </button>
            </div>
        </div>
    );
};

export default Login;