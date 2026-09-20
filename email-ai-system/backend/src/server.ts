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

// Đăng ký API Route
app.use('/api/emails', emailRoutes);

app.get('/', (req, res) => {
    res.send('AI Email System Backend API is running...');
});

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/email_ai_system';

mongoose
    .connect(MONGO_URI)
    .then(() => {
        console.log('MongoDB connected successfully');
        app.listen(PORT, () => {
            console.log(`Server is running on http://localhost:${PORT}`);
        });
    })
    .catch((err) => {
        console.error('MongoDB connection error:', err);
    });