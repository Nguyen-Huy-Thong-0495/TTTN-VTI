import { Response } from 'express';
import Email from '../models/Email';
import User from '../models/User';
import { AuthRequest } from '../middleware/authMiddleware';
import { sendReplyEmail, getQuickRepliesFromAI } from '../services/emailService';
import { fetchRealEmailsFromIMAP } from '../services/imapService';
import { fetchEmailsFromGmailApi } from '../services/gmailApiService';
import { analyzeEmailWithAI } from '../services/aiService';

// Cache mốc thời gian đồng bộ chống spam / overload API
const lastSyncMap = new Map<string, number>();
const COOLDOWN_MS = 15000; // Cooldown 15 giây giữa các lần quét thực tế

/**
 * Hàm phân tích rủi ro lừa đảo phụ trợ (dùng làm dự phòng khi AI không hoạt động)
 */
const analyzeEmailSecurity = (subject?: string, snippet?: string, sender?: string): { isPhishing: boolean; securityStatus: 'safe' | 'warning' | 'phishing' } => {
    let riskScore = 0;

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
 * Lấy danh sách Email của người dùng đang đăng nhập (Tôn trọng kết quả chuẩn từ AI/DB)
 */
export const getEmails = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id || req.userId;

        if (!userId) {
            return res.status(401).json({ message: 'Không tìm thấy thông tin xác thực người dùng.' });
        }

        const rawEmails = await Email.find({ userId })
            .sort({ receivedAt: -1 })
            .lean();

        const emails = rawEmails.map((mail: any) => {
            const isPhishing = Boolean(mail.isPhishing);
            const securityStatus = isPhishing ? 'phishing' : (mail.aiCategory === 'Phishing' ? 'phishing' : 'safe');

            return {
                ...mail,
                securityStatus,
                isPhishing
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
 * Đồng bộ Email THẬT từ Gmail / IMAP (Mapping chuẩn dữ liệu AI vào MongoDB)
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
        const hasAppPassword = (user.emailConfig?.isConnected && user.emailConfig?.emailAddress && user.emailConfig?.appPassword) || process.env.EMAIL_USER;

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
        } else {
            const syncEmailAddress = user.emailConfig?.emailAddress || process.env.EMAIL_USER;
            const syncAppPassword = user.emailConfig?.appPassword || process.env.EMAIL_PASS;
            if (syncEmailAddress && syncAppPassword) {
                console.log(`>>> [Sync Engine] Đang kết nối IMAP kéo email cho Hòm thư [${syncEmailAddress}]...`);
                realEmails = await fetchRealEmailsFromIMAP(syncEmailAddress, syncAppPassword);
            }
        }

        // Duyệt qua từng email thực tế và lưu vào MongoDB
        for (const mail of realEmails) {
            const existingEmail = await Email.findOne({ userId, messageId: mail.messageId });

            if (!existingEmail) {
                let senderObj = { name: 'Unknown Sender', email: 'unknown@domain.com' };
                if (typeof mail.sender === 'object' && mail.sender !== null) {
                    senderObj = {
                        name: mail.sender.name || mail.sender.email || 'Unknown',
                        email: mail.sender.email || 'unknown@domain.com'
                    };
                } else if (typeof mail.sender === 'string') {
                    senderObj = {
                        name: mail.sender,
                        email: mail.sender
                    };
                }

                const senderStr = senderObj.email;
                const securityCheck = analyzeEmailSecurity(mail.subject, mail.bodyText, senderStr);

                // Gọi AI phân tích qua aiService.ts
                let aiAnalysis: any = {};
                try {
                    aiAnalysis = await analyzeEmailWithAI(
                        mail.subject || '',
                        mail.bodyText || '',
                        senderStr || ''
                    );
                } catch (aiErr) {
                    console.error('Lỗi khi phân tích AI cho email, dùng giá trị mặc định:', aiErr);
                    aiAnalysis = {
                        priorityScore: 5,
                        aiCategory: 'Unclassified',
                        isPhishing: securityCheck.isPhishing,
                        aiSummary: mail.bodyText ? mail.bodyText.substring(0, 150) + '...' : '',
                        suggestedReply: ''
                    };
                }

                await Email.create({
                    userId,
                    messageId: mail.messageId || `MSG-${Date.now()}-${Math.random()}`,
                    sender: senderObj,
                    subject: mail.subject || '(Không có tiêu đề)',
                    bodyText: mail.bodyText || '',
                    priorityScore: typeof aiAnalysis.priorityScore === 'number' ? aiAnalysis.priorityScore : 5,
                    aiCategory: aiAnalysis.aiCategory || 'General',
                    isPhishing: Boolean(aiAnalysis.isPhishing || securityCheck.isPhishing),
                    aiSummary: aiAnalysis.aiSummary || '',
                    suggestedReply: aiAnalysis.suggestedReply || '',
                    status: 'Pending',
                    isAutoReplied: false,
                    receivedAt: mail.receivedAt ? new Date(mail.receivedAt) : new Date(),
                });
                console.log(`📥 Đã lưu email mới từ [${senderStr}] kèm AI Analysis vào MongoDB!`);
            }
        }

        lastSyncMap.set(userId, Date.now());

        const rawUpdatedEmails = await Email.find({ userId }).sort({ receivedAt: -1 }).lean();
        const updatedEmails = rawUpdatedEmails.map((mail: any) => {
            const isPhishing = Boolean(mail.isPhishing);
            const securityStatus = isPhishing ? 'phishing' : (mail.aiCategory === 'Phishing' ? 'phishing' : 'safe');
            return {
                ...mail,
                securityStatus,
                isPhishing
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
 * Gửi email phản hồi
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

        // Lấy cấu hình email từ Database hoặc tự động fallback sang file .env trên VPS
        const senderEmail = user.emailConfig?.emailAddress || process.env.EMAIL_USER;
        const senderPassword = user.emailConfig?.appPassword || process.env.EMAIL_PASS;

        if (!senderEmail || !senderPassword) {
            return res.status(400).json({
                message: 'Vui lòng kết nối và cấu hình Email/App Password trong phần Cài đặt trước khi gửi mail.'
            });
        }

        await sendReplyEmail(
            to,
            subject,
            replyContent,
            senderEmail,
            senderPassword,
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

/**
 * Lấy danh sách câu trả lời gợi ý từ AI
 */
export const getQuickReplies = async (req: AuthRequest, res: Response) => {
    try {
        const { subject, body, category } = req.body;

        const suggestions = await getQuickRepliesFromAI(
            subject || '',
            body || '',
            category
        );

        return res.status(200).json({
            success: true,
            suggestions
        });
    } catch (error) {
        console.error('Lỗi khi lấy gợi ý AI:', error);
        return res.status(500).json({
            success: false,
            message: 'Không thể tạo gợi ý từ AI lúc này.',
            error: error instanceof Error ? error.message : error
        });
    }
};