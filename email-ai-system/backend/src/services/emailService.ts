import nodemailer from 'nodemailer';
// Nếu bạn dùng Google Gen AI SDK hoặc OpenAI SDK, hãy import ở đây, ví dụ:
// import { GoogleGenAI } from '@google/genai';

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
 * Gợi ý câu trả lời nhanh bằng AI dựa trên tiêu đề, nội dung email và phân loại
 * @param subject Tiêu đề email
 * @param body Nội dung chi tiết hoặc tóm tắt email
 * @param category Phân loại email từ hệ thống AI
 */
export const getQuickRepliesFromAI = async (
    subject: string,
    body: string,
    category?: string
): Promise<string[]> => { 
    try {
        // Tùy chọn 1: Gọi đến Gemini API hoặc OpenAI API thật của bạn
        /*
        const apiKey = process.env.GEMINI_API_KEY;
        if (apiKey) {
            const ai = new GoogleGenAI({ apiKey });
            const prompt = `Dựa vào email sau, hãy đề xuất 3 câu trả lời ngắn gọn, lịch sự bằng tiếng Việt dưới dạng mảng JSON thuần túy gồm các chuỗi:
            Tiêu đề: ${subject}
            Phân loại: ${category || 'General'}
            Nội dung: ${body}`;
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
            });
            // Parse kết quả trả về từ AI...
        }
        */

        // Tùy chọn 2: Fallback thông minh / Mock linh hoạt theo ngữ cảnh nội dung nếu chưa gọi API AI ngoài
        const lowerContent = `${subject} ${body}`.toLowerCase();
        
        if (lowerContent.includes('hợp đồng') || lowerContent.includes('contract') || lowerContent.includes('báo giá')) {
            return [
                "Chào bạn, tôi đã nhận được thông tin báo giá/hợp đồng và sẽ xem xét phản hồi sớm.",
                "Cảm ơn bạn đã gửi tài liệu. Chúng tôi cần thêm một số chỉnh sửa nhỏ trước khi ký kết.",
                "Tôi đã chuyển thông tin này cho bộ phận pháp chế kiểm tra và sẽ phản hồi trong hôm nay."
            ];
        } 
        
        if (lowerContent.includes('lỗi') || lowerContent.includes('bug') || lowerContent.includes('sự cố') || lowerContent.includes('error')) {
            return [
                "Cảm ơn bạn đã thông báo sự cố. Đội ngũ kỹ thuật đang tiến hành kiểm tra ngay.",
                "Chúng tôi đã ghi nhận lỗi này và sẽ khắc phục trong thời gian sớm nhất.",
                "Bạn có thể cung cấp thêm hình ảnh hoặc log chi tiết của lỗi này được không?"
            ];
        }

        // Mặc định cho các trường hợp khác
        return [
            "Chào bạn, tôi đã nhận được thông tin và sẽ phản hồi chi tiết sớm nhất.",
            "Cảm ơn bạn đã liên hệ. Chúng tôi đang xử lý yêu cầu của bạn.",
            "Vui lòng cung cấp thêm thông tin chi tiết để chúng tôi hỗ trợ tốt hơn."
        ];
    } catch (error) {
        console.error('❌ Lỗi khi lấy gợi ý từ AI:', error);
        return [
            "Cảm ơn bạn đã liên hệ, chúng tôi sẽ phản hồi sớm.",
            "Đã nhận được thông tin từ bạn."
        ];
    }
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