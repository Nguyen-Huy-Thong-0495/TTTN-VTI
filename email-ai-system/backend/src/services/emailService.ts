import nodemailer from 'nodemailer';

/**
 * Phân tích và chấm điểm rủi ro bảo mật của email (Phishing & Scam Detection)
 * @param subject Tiêu đề email
 * @param snippet Đoạn nội dung tóm tắt / nội dung email
 * @param sender Địa chỉ hoặc tên người gửi (From)
 */
export const analyzeEmailSecurity = (
    subject?: string, 
    snippet?: string, 
    sender?: string
): 'safe' | 'warning' | 'phishing' => {
    let riskScore = 0;
    
    // Các từ khóa nhạy cảm, cấp bách thường xuất hiện trong email lừa đảo, giả mạo tài khoản
    const phishingKeywords = [
        'urgent', 'verify your account', 'password reset', 'trúng thưởng', 
        'đăng nhập ngay', 'khóa tài khoản', 'cảnh báo khẩn cấp', 
        'suspended', 'update billing', 'click here immediately', 'xác thực tài khoản'
    ];
    
    const content = `${subject || ''} ${snippet || ''}`.toLowerCase();
    
    // Kiểm tra từ khóa
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

    // Phân loại mức độ rủi ro dựa trên tổng điểm
    if (riskScore >= 4) {
        return 'phishing'; // Nguy cơ lừa đảo cao (Gắn nhãn đỏ)
    } else if (riskScore >= 2) {
        return 'warning';  // Khẩn cấp / cần chú ý (Gắn nhãn vàng)
    }
    return 'safe';       // An toàn (Gắn nhãn xanh)
};

/**
 * Gửi email phản hồi tự động sử dụng cấu hình Gmail riêng của từng User
 * @param to Email người nhận
 * @param subject Tiêu đề
 * @param text Nội dung phản hồi
 * @param emailAddress (Optional) Địa chỉ Gmail của User
 * @param appPassword (Optional) Mật khẩu ứng dụng 16 ký tự của User
 * @param senderName (Optional) Tên hiển thị của người gửi
 */
export const sendReplyEmail = async (
    to: string, 
    subject: string, 
    text: string,
    emailAddress?: string,
    appPassword?: string,
    senderName?: string
) => {
    try {
        // Ưu tiên dùng thông tin tài khoản của User, nếu không có mới dùng biến môi trường .env
        const userEmail = emailAddress || process.env.EMAIL_USER;
        const userPass = appPassword || process.env.EMAIL_PASS;

        if (!userEmail || !userPass) {
            throw new Error('Chưa cấu hình tài khoản Email gửi đi (Địa chỉ email hoặc Mật khẩu ứng dụng bị thiếu).');
        }

        // Tạo Transporter linh hoạt dựa theo tài khoản của từng User
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: userEmail,
                pass: userPass,
            },
        });

        // Tránh trùng lặp tiêu đề "Re: Re: ..."
        const cleanSubject = subject || '';
        const formattedSubject = cleanSubject.startsWith('Re:') 
            ? cleanSubject 
            : `Re: ${cleanSubject}`;

        const displayName = senderName || 'AI Email Smart Agent';

        const mailOptions = {
            from: `"${displayName}" <${userEmail}>`,
            to,
            subject: formattedSubject,
            text,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Email đã được gửi thành công từ [${userEmail}] tới [${to}]:`, info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ Lỗi khi gửi email qua SMTP:', error);
        throw error;
    }
};