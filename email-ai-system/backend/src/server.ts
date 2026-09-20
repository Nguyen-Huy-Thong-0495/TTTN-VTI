import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import emailRoutes from './routes/emailRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/emails', emailRoutes);

// Kết nối MongoDB trước khi chạy Server
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/email-ai-system';

mongoose
    .connect(MONGO_URI)
    .then(() => {
        console.log('>>> Đã kết nối MongoDB thành công!');
        app.listen(PORT, () => {
            console.log(`>>> Server backend đang chạy tại http://localhost:${PORT}`);
        });
    })
    .catch((err) => {
        console.error('>>> Lỗi kết nối MongoDB:', err);
    });

// Thêm dòng này để kiểm tra mọi request đi vào server
app.use((req, res, next) => {
    console.log(`>>> [LOG] ${req.method} ${req.url}`);
    next();
});

app.use('/api/emails', emailRoutes);