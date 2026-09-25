import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';

// Import các Routes
import emailRoutes from './routes/emailRoutes';
import authRoutes from './routes/authRoutes';
import adminRoutes from './routes/adminRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/email-ai-system';

// MIDDLEWARE TOÀN CỤC
app.use(cors());
app.use(express.json());

app.use((req: Request, res: Response, next: NextFunction) => {
    console.log(`>>> [LOG] ${req.method} ${req.originalUrl}`);
    next();
});

// KHAI BÁO CÁC API ROUTES
app.use('/api/auth', authRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/admin', adminRoutes);

// API kiểm tra trạng thái máy chủ
app.get('/api/health', (req: Request, res: Response) => {
    res.status(200).json({ message: 'Backend AI Email Smart Agent đang hoạt động!' });
});

// Phục vụ giao diện Frontend (ReactJS/Vite build folder)
const frontendPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendPath));

// DÙNG CÚ PHÁP TƯƠNG THÍCH EXPRESS 5+: /{*splat} thay vì '*'
app.get('/{*splat}', (req: Request, res: Response) => {
    if (!req.originalUrl.startsWith('/api')) {
        res.sendFile(path.join(frontendPath, 'index.html'));
    } else {
        res.status(404).json({ message: `Endpoint ${req.originalUrl} không tồn tại trên hệ thống!` });
    }
});

// KẾT NỐI DATABASE VÀ KHỞI CHẠY SERVER
mongoose
    .connect(MONGO_URI)
    .then(() => {
        console.log('>>> Đã kết nối MongoDB thành công!');
        app.listen(PORT, () => {
            console.log(`>>> Server và Frontend đang chạy chung tại: http://localhost:${PORT}`);
        });
    })
    .catch((err) => {
        console.error('>>> Lỗi kết nối MongoDB:', err);
        process.exit(1);
    });