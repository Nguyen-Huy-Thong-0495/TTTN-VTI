import { Request, Response } from 'express';
import nodemailer from 'nodemailer';
import Email from '../models/Email'; // 🟢 Import default (KHÔNG dùng ngoặc nhọn {})

/**
 * 1. Lấy danh sách tất cả Email từ MongoDB
 */
export const getEmails = async (req: Request, res: Response) => {
    try {
        const emails = await Email.find().sort({ receivedAt: -1 });
        res.status(200).json(emails);
    } catch (error) {
        console.error('Lỗi khi lấy danh sách email:', error);
        res.status(500).json({ message: 'Lỗi khi lấy danh sách email', error });
    }
};

/**
 * 2. Đồng bộ Email mới (Khởi tạo dữ liệu mẫu khớp với Schema nếu DB trống)
 */
export const syncEmails = async (req: Request, res: Response) => {
    try {
        console.log('>>> Đang tiến hành đồng bộ dữ liệu vào MongoDB...');

        const count = await Email.countDocuments();
        if (count === 0) {
            await Email.insertMany([
                {
                    messageId: 'msg-001',
                    sender: {
                        name: 'Ngân hàng Techcombank (Cảnh báo)',
                        email: 'security@verify-techcombank.com',
                    },
                    subject: 'CẢNH BÁO: Tài khoản bị khóa, xác thực thông tin NGAY!',
                    bodyText: 'Tài khoản của quý khách phát hiện đăng nhập bất thường. Vui lòng nhấp vào liên kết để xác minh.',
                    priorityScore: 10,
                    aiCategory: 'Phishing',
                    isPhishing: true,
                    phishingReason: 'Email mạo danh ngân hàng chứa liên kết xác thực nghi vấn.',
                    aiSummary: 'Email giả mạo ngân hàng yêu cầu truy cập liên kết lạ để xác minh tài khoản.',
                    status: 'Pending',
                    isAutoReplied: false,
                    receivedAt: new Date(),
                },
                {
                    messageId: 'msg-002',
                    sender: {
                        name: 'Trần Thị B',
                        email: 'tranb@partner.com',
                    },
                    subject: 'Yêu cầu báo giá gói tích hợp AI Email Agent',
                    bodyText: 'Chào công ty, bên mình đang tìm hiểu giải pháp AI Email Agent. Vui lòng tư vấn báo giá.',
                    priorityScore: 9,
                    aiCategory: 'Sales / Lead',
                    isPhishing: false,
                    aiSummary: 'Khách hàng yêu cầu tư vấn và báo giá giải pháp AI Email Agent.',
                    suggestedReply: 'Chào chị B, cảm ơn chị đã quan tâm. Em xin gửi bảng báo giá chi tiết đi kèm qua email này ạ.',
                    status: 'Pending',
                    isAutoReplied: false,
                    receivedAt: new Date(),
                },
            ]);
            console.log('>>> Đã tạo dữ liệu mẫu thành công vào MongoDB!');
        }

        const updatedEmails = await Email.find().sort({ receivedAt: -1 });
        res.status(200).json({ message: 'Đồng bộ email thành công!', data: updatedEmails });
    } catch (error) {
        console.error('Lỗi khi đồng bộ email:', error);
        res.status(500).json({ message: 'Lỗi khi đồng bộ email', error });
    }
};

/**
 * 3. Gửi email phản hồi qua Nodemailer & Cập nhật DB
 */
export const sendReply = async (req: Request, res: Response) => {
    try {
        const { to, subject, replyContent, emailId } = req.body;

        if (!to || !replyContent) {
            return res.status(400).json({ message: 'Thiếu địa chỉ người nhận hoặc nội dung email.' });
        }

        // Cấu hình Nodemailer
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        // Gửi email thật
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: to,
            subject: subject?.startsWith('Re:') ? subject : `Re: ${subject || ''}`,
            text: replyContent,
        });

        // Cập nhật trạng thái isAutoReplied trong MongoDB
        if (emailId) {
            await Email.findByIdAndUpdate(emailId, { isAutoReplied: true, status: 'Resolved' });
        }

        res.status(200).json({ message: 'Gửi email phản hồi thành công!' });
    } catch (error) {
        console.error('Lỗi khi gửi email:', error);
        res.status(500).json({
            message: 'Không thể gửi email. Vui lòng kiểm tra lại EMAIL_USER / EMAIL_PASS trong file backend/.env!',
            error,
        });
    }
};