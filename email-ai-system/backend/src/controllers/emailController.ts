import { Response } from 'express';
import Email from '../models/Email';
import User from '../models/User';
import { AuthRequest } from '../middleware/authMiddleware';
import { sendReplyEmail } from '../services/emailService';
import { fetchRealEmailsFromIMAP } from '../services/imapService';
import { fetchEmailsFromGmailApi } from '../services/gmailApiService';

// Cache mốc thời gian đồng bộ chống spam / overload API
const lastSyncMap = new Map<string, number>();
const COOLDOWN_MS = 15000; // Cooldown 15 giây giữa các lần quét thực tế

/**
 * Hàm phân tích rủi ro lừa đảo (Phishing & Scam Detection) cho từng email
 */
const analyzeEmailSecurity = (subject?: string, snippet?: string, sender?: string): { isPhishing: boolean; securityStatus: 'safe' | 'warning' | 'phishing' } => {
    let riskScore = 0;
    
    // Các từ khóa nhạy cảm, cấp bách thường xuất hiện trong email lừa đảo, giả mạo tài khoản
    const phishingKeywords = [
        'urgent', 'verify your account', 'password reset', 'trúng thưởng', 
        'đăng nhập ngay', 'khóa tài khoản', 'cảnh báo khẩn cấp', 
        'suspended', 'update billing', 'click here immediately', 'xác thực tài khoản'
    ];
    
    const content = `${subject || ''} ${snippet || ''}`.toLowerCase();
    
    phishingKeywords.forEach(keyword => {
        if (content.includes(keyword)) {
            riskScore += 2;
        }
    });

    // Kiểm tra tên miền hoặc định dạng người gửi giả mạo đáng ngờ
    const senderLower = (sender || '').toLowerCase();
    if (
        senderLower.includes('g00gle') || 
        senderLower.includes('support-sec') || 
        senderLower.includes('security-update-center') ||
        senderLower.includes('banking-secure-login')
    ) {
        riskScore += 5;
    }

    if (riskScore >= 4) {
        return { isPhishing: true, securityStatus: 'phishing' };
    } else if (riskScore >= 2) {
        return { isPhishing: false, securityStatus: 'warning' };
    }
    return { isPhishing: false, securityStatus: 'safe' };
};

/**
 * Lấy danh sách Email của người dùng đang đăng nhập
 */
export const getEmails = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id || req.userId;

        if (!userId) {
            return res.status(401).json({ message: 'Không tìm thấy thông tin xác thực người dùng.' });
        }

        // Chỉ lấy các email thuộc sở hữu của User này
        const rawEmails = await Email.find({ userId })
            .sort({ receivedAt: -1 })
            .lean();

        // Đính kèm trạng thái bảo mật dựa trên nội dung để trả về cho Frontend
        const emails = rawEmails.map((mail: any) => {
            const analysis = analyzeEmailSecurity(mail.subject, mail.bodyText || mail.aiSummary, typeof mail.sender === 'string' ? mail.sender : mail.sender?.email);
            return {
                ...mail,
                securityStatus: analysis.securityStatus,
                isPhishing: analysis.isPhishing || mail.isPhishing
            };
        });

        console.log(`🔍 [GetEmails] Request từ User [${userId}] -> Trả về ${emails.length} email.`);
        return res.status(200).json(emails);
    } catch (error) {
        console.error('Lỗi khi lấy danh sách email:', error);
        return res.status(500).json({ message: 'Lỗi hệ thống khi lấy danh sách email', error });
    }
};

/**
 * Đồng bộ Email THẬT từ Gmail (Hỗ trợ cả Google OAuth Token và IMAP App Password)
 */
export const syncEmails = async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id || req.userId;

    if (!userId) {
        return res.status(401).json({ message: 'Không tìm thấy thông tin xác thực người dùng.' });
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'Không tìm thấy thông tin người dùng.' });
        }

        const hasGoogleToken = user.googleTokens && user.googleTokens.accessToken;
        const hasAppPassword = user.emailConfig?.isConnected && user.emailConfig?.emailAddress && user.emailConfig?.appPassword;

        if (!hasGoogleToken && !hasAppPassword) {
            const userEmails = await Email.find({ userId }).sort({ receivedAt: -1 }).lean();
            return res.status(200).json(userEmails);
        }

        const now = Date.now();
        const lastSyncTime = lastSyncMap.get(userId) || 0;

        if (now - lastSyncTime < COOLDOWN_MS) {
            const cachedEmails = await Email.find({ userId }).sort({ receivedAt: -1 }).lean();
            return res.status(200).json(cachedEmails);
        }

        let realEmails: any[] = [];

        if (hasGoogleToken) {
            console.log(`>>> [Sync Engine] Đang gọi Gmail API cho User ID [${userId}]...`);
            realEmails = await fetchEmailsFromGmailApi(user.googleTokens!.accessToken!);
        } else if (hasAppPassword) {
            console.log(`>>> [Sync Engine] Đang kết nối IMAP kéo email cho Hòm thư [${user.emailConfig?.emailAddress}]...`);
            realEmails = await fetchRealEmailsFromIMAP(user.emailConfig!.emailAddress!, user.emailConfig!.appPassword!);
        }

        // Duyệt qua từng email thật và lưu vào MongoDB kèm quét bảo mật
        for (const mail of realEmails) {
            const existingEmail = await Email.findOne({ userId, messageId: mail.messageId });

            if (!existingEmail) {
                const senderStr = typeof mail.sender === 'string' ? mail.sender : mail.sender?.email;
                const securityCheck = analyzeEmailSecurity(mail.subject, mail.bodyText, senderStr);

                await Email.create({
                    userId,
                    messageId: mail.messageId,
                    sender: mail.sender,
                    subject: mail.subject,
                    bodyText: mail.bodyText,
                    priorityScore: 5,
                    aiCategory: 'General',
                    isPhishing: securityCheck.isPhishing, // Lưu kết quả phát hiện lừa đảo
                    aiSummary: mail.bodyText ? mail.bodyText.substring(0, 150) + '...' : 'Không có nội dung',
                    status: 'Pending',
                    isAutoReplied: false,
                    receivedAt: mail.receivedAt,
                });
                console.log(`📥 Đã lưu email mới từ [${senderStr}] (Phishing: ${securityCheck.isPhishing}) vào MongoDB!`);
            }
        }

        lastSyncMap.set(userId, Date.now());

        const rawUpdatedEmails = await Email.find({ userId }).sort({ receivedAt: -1 }).lean();
        const updatedEmails = rawUpdatedEmails.map((mail: any) => {
            const analysis = analyzeEmailSecurity(mail.subject, mail.bodyText || mail.aiSummary, typeof mail.sender === 'string' ? mail.sender : mail.sender?.email);
            return {
                ...mail,
                securityStatus: analysis.securityStatus,
                isPhishing: analysis.isPhishing || mail.isPhishing
            };
        });

        console.log(`✅ [Sync Engine] Đồng bộ xong. Trả về ${updatedEmails.length} email cho User [${userId}].`);
        return res.status(200).json(updatedEmails);

    } catch (error) {
        console.error('Lỗi khi đồng bộ email:', error);
        const fallbackEmails = await Email.find({ userId }).sort({ receivedAt: -1 }).lean();
        return res.status(200).json(fallbackEmails);
    }
};

/**
 * Gửi email phản hồi bằng tài khoản SMTP cá nhân của User, Cập nhật Token & Trạng thái DB
 */
export const sendReply = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id || req.userId;
        const { to, subject, replyContent, emailId } = req.body;

        if (!userId) {
            return res.status(401).json({ message: 'Không tìm thấy thông tin xác thực người dùng.' });
        }

        if (!to || !replyContent) {
            return res.status(400).json({ message: 'Thiếu địa chỉ người nhận (to) hoặc nội dung (replyContent).' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'Tài khoản người dùng không tồn tại trong hệ thống.' });
        }

        if (user.tokensUsed >= user.tokenLimit) {
            return res.status(403).json({
                message: `Bạn đã sử dụng hết hạn mức Token (${user.tokensUsed}/${user.tokenLimit}). Vui lòng liên hệ Admin để nâng hạn mức!`
            });
        }

        const emailConfig = user.emailConfig;
        if (!emailConfig || !emailConfig.isConnected || !emailConfig.emailAddress || !emailConfig.appPassword) {
            return res.status(400).json({
                message: 'Vui lòng kết nối và cấu hình Email/App Password trong phần Cài đặt trước khi gửi mail.'
            });
        }

        await sendReplyEmail(
            to,
            subject,
            replyContent,
            emailConfig.emailAddress,
            emailConfig.appPassword,
            user.name || 'AI Smart Agent'
        );

        const estimatedTokens = Math.max(50, Math.ceil(replyContent.length / 4));
        await User.findByIdAndUpdate(userId, {
            $inc: { tokensUsed: estimatedTokens }
        });

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

        return res.status(200).json({
            message: 'Gửi email phản hồi thành công!',
            tokensConsumed: estimatedTokens,
            totalTokensUsed: user.tokensUsed + estimatedTokens
        });
    } catch (error: any) {
        console.error('Lỗi khi gửi email phản hồi:', error);
        return res.status(500).json({
            message: 'Không thể gửi email. Vui lòng kiểm tra lại cấu hình App Password trong Cài đặt tài khoản!',
            error: error.message || error,
        });
    }
};