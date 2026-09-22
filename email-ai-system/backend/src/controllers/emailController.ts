import { Response } from 'express';
import Email from '../models/Email';
import User from '../models/User';
import { AuthRequest } from '../middleware/authMiddleware';
import { sendReplyEmail } from '../services/emailService';
import { fetchRealEmailsFromIMAP } from '../services/imapService';

// Cache mốc thời gian đồng bộ chống spam / overload API
const lastSyncMap = new Map<string, number>();
const COOLDOWN_MS = 15000; // Cooldown 15 giây giữa các lần quét IMAP thực tế

/**
 * Lấy danh sách Email của người dùng đang đăng nhập
 */
export const getEmails = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({ message: 'Không tìm thấy thông tin xác thực người dùng.' });
        }

        // Tìm email gán với userId này HOẶC các email chung (chưa có userId)
        const emails = await Email.find({
            $or: [{ userId }, { userId: {$exists: false } }, { userId: null }]
        })
            .sort({ receivedAt: -1 })
            .lean();

        console.log(`🔍 [GetEmails] Request từ User [${userId}] -> Trả về ${emails.length} email.`);
        return res.status(200).json(emails);
    } catch (error) {
        console.error('Lỗi khi lấy danh sách email:', error);
        return res.status(500).json({ message: 'Lỗi hệ thống khi lấy danh sách email', error });
    }
};

/**
 * Đồng bộ Email THẬT từ Gmail qua IMAP vào MongoDB
 */
export const syncEmails = async (req: AuthRequest, res: Response) => {
    const userId = req.userId;

    if (!userId) {
        return res.status(401).json({ message: 'Không tìm thấy thông tin xác thực người dùng.' });
    }

    try {
        const now = Date.now();
        const lastSyncTime = lastSyncMap.get(userId) || 0;

        // Nếu Frontend Polling dưới mốc Cooldown, trả về dữ liệu DB hiện tại
        if (now - lastSyncTime < COOLDOWN_MS) {
            const cachedEmails = await Email.find({
                $or: [{ userId }, { userId: {$exists: false } }, { userId: null }]
            }).sort({ receivedAt: -1 }).lean();

            return res.status(200).json(cachedEmails);
        }

        console.log(`>>> [Sync Engine] Đang kết nối IMAP kéo email THẬT cho User [${userId}]...`);

        // 1. Tải email thật từ hòm thư Gmail qua IMAP
        const realEmails = await fetchRealEmailsFromIMAP();

        // 2. Duyệt qua từng email thật và lưu vào MongoDB
        for (const mail of realEmails) {
            // Kiểm tra tồn tại theo messageId toàn hệ thống (không phân biệt userId)
            const existingEmail = await Email.findOne({ messageId: mail.messageId });

            if (!existingEmail) {
                await Email.create({
                    userId,
                    messageId: mail.messageId,
                    sender: mail.sender,
                    subject: mail.subject,
                    bodyText: mail.bodyText,
                    priorityScore: 5, // Mặc định
                    aiCategory: 'General',
                    isPhishing: false,
                    aiSummary: mail.bodyText ? mail.bodyText.substring(0, 150) + '...' : 'Không có nội dung',
                    status: 'Pending',
                    isAutoReplied: false,
                    receivedAt: mail.receivedAt,
                });
                console.log(`📥 Đã lưu email mới từ [${mail.sender.email}] vào MongoDB!`);
            } else if (!existingEmail.userId) {
                // Nếu email đã có nhưng chưa được gán userId, cập nhật userId cho người dùng hiện tại
                existingEmail.userId = userId as any;
                await existingEmail.save();
            }
        }

        // Cập nhật mốc thời gian đồng bộ thành công
        lastSyncMap.set(userId, Date.now());

        // 3. Trả về toàn bộ email mới nhất từ MongoDB
        const updatedEmails = await Email.find({
            $or: [{ userId }, { userId: {$exists: false } }, { userId: null }]
        }).sort({ receivedAt: -1 }).lean();

        console.log(`✅ [Sync Engine] Đồng bộ xong. Trả về ${updatedEmails.length} email cho User [${userId}].`);
        return res.status(200).json(updatedEmails);

    } catch (error) {
        console.error('Lỗi khi đồng bộ email IMAP:', error);

        // Fallback: Khi có lỗi kết nối/mạng, vẫn trả về danh sách DB hiện tại
        const fallbackEmails = await Email.find({
            $or: [{ userId }, { userId: {$exists: false } }, { userId: null }]
        }).sort({ receivedAt: -1 }).lean();
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

        const userExists = await User.exists({ _id: userId });
        if (!userExists) {
            return res.status(404).json({ message: 'Tài khoản người dùng không tồn tại trong hệ thống.' });
        }

        // Gửi email qua helper service
        await sendReplyEmail(to, subject, replyContent);

        // Cập nhật trạng thái trong DB
        if (emailId) {
            await Email.findOneAndUpdate(
                { _id: emailId },
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