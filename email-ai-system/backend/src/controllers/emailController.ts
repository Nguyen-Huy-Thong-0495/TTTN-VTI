import { Response } from 'express';
import Email from '../models/Email';
import User from '../models/User';
import { AuthRequest } from '../middleware/authMiddleware';
import { sendReplyEmail } from '../services/emailService'; // Tách biệt logic gửi mail qua service

// Cache mốc thời gian đồng bộ chống spam / overload API
const lastSyncMap = new Map<string, number>();
const COOLDOWN_MS = 15000; // Cooldown 15 giây

/**
 * Hàm hỗ trợ tạo dữ liệu mẫu khởi tạo cho tài khoản mới
 */
const generateSeedEmails = (userId: string) => {
    const timestamp = Date.now();
    return [
        {
            userId,
            messageId: `msg-${timestamp}-001`,
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
            userId,
            messageId: `msg-${timestamp}-002`,
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
    ];
};

/**
 * Lấy danh sách Email của người dùng đang đăng nhập
 */
export const getEmails = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({ message: 'Không tìm thấy thông tin xác thực người dùng.' });
        }

        const emails = await Email.find({ userId })
            .sort({ receivedAt: -1 })
            .lean();

        return res.status(200).json(emails);
    } catch (error) {
        console.error('Lỗi khi lấy danh sách email:', error);
        return res.status(500).json({ message: 'Lỗi hệ thống khi lấy danh sách email', error });
    }
};

/**
 * Đồng bộ Email mới (Tích hợp Cooldown cho Polling & Khởi tạo dữ liệu mẫu nếu DB trống)
 */
export const syncEmails = async (req: AuthRequest, res: Response) => {
    const userId = req.userId;

    if (!userId) {
        return res.status(401).json({ message: 'Không tìm thấy thông tin xác thực người dùng.' });
    }

    try {
        const now = Date.now();
        const lastSyncTime = lastSyncMap.get(userId) || 0;

        // Nếu Frontend Polling dưới mốc Cooldown, trả về dữ liệu hiện tại ngay
        if (now - lastSyncTime < COOLDOWN_MS) {
            const cachedEmails = await Email.find({ userId }).sort({ receivedAt: -1 }).lean();
            return res.status(200).json(cachedEmails);
        }

        console.log(`>>> [Sync Engine] Đang kiểm tra & đồng bộ hòm thư cho User [${userId}]...`);

        // Đếm số lượng email hiện có
        const count = await Email.countDocuments({ userId });

        // Tạo dữ liệu mẫu nếu người dùng chưa có email
        if (count === 0) {
            await Email.insertMany(generateSeedEmails(userId));
            console.log(`>>> [Sync Engine] Đã khởi tạo dữ liệu mẫu cho User [${userId}]`);
        }

        // Cập nhật mốc thời gian đồng bộ mới nhất
        lastSyncMap.set(userId, Date.now());

        const updatedEmails = await Email.find({ userId }).sort({ receivedAt: -1 }).lean();
        return res.status(200).json(updatedEmails);

    } catch (error) {
        console.error('Lỗi khi đồng bộ email:', error);

        // Fallback: Khi xảy ra lỗi ngoài ý muốn, trả về danh sách DB hiện có để không làm gián đoạn Polling ở Frontend
        const fallbackEmails = await Email.find({ userId }).sort({ receivedAt: -1 }).lean();
        return res.status(200).json(fallbackEmails);
    }
};

/**
 * Gửi email phản hồi & Cập nhật trạng thái trong Database
 */
export const sendReply = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId;
        const { to, subject, replyContent, emailId } = req.body;

        if (!userId) {
            return res.status(401).json({ message: 'Không tìm thấy thông tin xác thực người dùng.' });
        }

        if (!to || !replyContent) {
            return res.status(400).json({ message: 'Thiếu địa chỉ người nhận (to) hoặc nội dung (replyContent).' });
        }

        // Kiểm tra tài khoản người dùng có tồn tại
        const userExists = await User.exists({ _id: userId });
        if (!userExists) {
            return res.status(404).json({ message: 'Tài khoản người dùng không tồn tại trong hệ thống.' });
        }

        // Gọi hàm gửi mail qua helper/service
        await sendReplyEmail(to, subject, replyContent);

        // Cập nhật trạng thái Email đã được phản hồi thành công
        if (emailId) {
            await Email.findOneAndUpdate(
                { _id: emailId, userId },
                {
                    $set: {
                        isAutoReplied: true,
                        status: 'Resolved',
                    },
                },
                { new: true }
            );
        }

        return res.status(200).json({ message: 'Gửi email phản hồi thành công!' });
    } catch (error: any) {
        console.error('Lỗi khi gửi email phản hồi:', error);
        return res.status(500).json({
            message: 'Không thể gửi email. Vui lòng kiểm tra lại cấu hình Nodemailer trong .env!',
            error: error.message || error,
        });
    }
};