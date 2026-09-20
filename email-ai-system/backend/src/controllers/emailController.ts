import { Request, Response } from 'express';
import Email from '../models/Email';
import { analyzeEmailWithAI } from '../services/aiService';

export const getEmails = async (req: Request, res: Response) => {
    try {
        const emails = await Email.find().sort({ receivedAt: -1 });
        return res.status(200).json(emails);
    } catch (error) {
        return res.status(500).json({ message: 'Lỗi server khi lấy danh sách email', error });
    }
};

export const syncEmails = async (req: Request, res: Response) => {
    try {
        // Dữ liệu Email thô cần phân tích
        const rawEmails = [
            {
                messageId: `msg-${Date.now()}-1`,
                sender: { name: 'Thanh Toán VPBank', email: 'no-reply@security-vpbank-update.com' },
                subject: 'CẢNH BÁO: Tài khoản VPBank bị khóa do nhập sai OTP quá 3 lần',
                bodyText: 'Kính gửi quý khách, tài khoản ngân hàng của bạn tạm thời bị khóa. Vui lòng nhấp vào đây https://verify-vpbank.top để mở khóa.',
                receivedAt: new Date()
            },
            {
                messageId: `msg-${Date.now()}-2`,
                sender: { name: 'Nguyễn Văn A', email: 'angana@company.com' },
                subject: 'Báo cáo tiến độ dự án AI Email Smart Agent - Tuần 3',
                bodyText: 'Chào sếp, tuần này bên em đã hoàn thành tích hợp Gemini AI và giao diện Dashboard. Sếp xem qua và cho em xin ý kiến phản hồi nhé.',
                receivedAt: new Date(Date.now() - 3600000)
            }
        ];

        const processedEmails = [];

        for (const raw of rawEmails) {
            // 1. Phân tích nội dung qua Gemini AI
            const aiResult = await analyzeEmailWithAI(raw.subject, raw.bodyText, raw.sender.email);

            // 2. Tổng hợp dữ liệu để lưu MongoDB
            processedEmails.push({
                ...raw,
                ...aiResult
            });
        }

        // Chèn dữ liệu đã phân tích vào Database
        await Email.insertMany(processedEmails);

        return res.status(200).json({
            message: 'Đồng bộ và phân tích AI thành công!',
            total: processedEmails.length
        });
    } catch (error) {
        return res.status(500).json({ message: 'Lỗi khi đồng bộ email', error });
    }
};