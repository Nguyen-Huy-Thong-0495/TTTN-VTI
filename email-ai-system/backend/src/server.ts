import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import emailRoutes from './routes/emailRoutes';
import authRoutes from './routes/authRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/email-ai-system';

// TOÀN CỤC 
app.use(cors());
app.use(express.json());

app.use((req: Request, res: Response, next: NextFunction) => {
    console.log(`>>> [LOG] ${req.method} ${req.originalUrl}`);
    next();
});


// KHAI BÁO CÁC ROUTES (Chỉ khai báo 1 LẦN duy nhất)
app.get('/', (req: Request, res: Response) => {
    res.status(200).json({ message: 'Backend AI Email Smart Agent đang hoạt động!' });
});

// Routes Authentication & Email
app.use('/api/auth', authRoutes);
app.use('/api/emails', emailRoutes);


// XỬ LÝ ROUTE KHÔNG TỒN TẠI (404 HANDLER)
app.use((req: Request, res: Response) => {
    res.status(404).json({ message: `Endpoint ${req.originalUrl} không tồn tại trên hệ thống!` });
});

// KẾT NỐI DATABASE VÀ KHỞI CHẠY SERVER
mongoose
    .connect(MONGO_URI)
    .then(() => {
        console.log('>>> Đã kết nối MongoDB thành công!');
        app.listen(PORT, () => {
            console.log(`>>> Server backend đang chạy tại: http://localhost:${PORT}`);
        });
    })
    .catch((err) => {
        console.error('>>> Lỗi kết nối MongoDB:', err);
        process.exit(1); // Dừng tiến trình nếu kết nối DB thất bại
    });