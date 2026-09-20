import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.warn('⚠️ GEMINI_API_KEY chưa được cấu hình trong file .env!');
}

const genAI = new GoogleGenerativeAI(apiKey || '');

// TypeScript Interface cho kết quả phân tích
export interface AIAnalysisResult {
    aiCategory: string;
    isPhishing: boolean;
    phishingReason?: string;
    isSpamOrPromo: boolean;
    priorityScore: number;
    priorityReason?: string;
    aiSummary: string;
    suggestedReply?: string;
}

/**
 * Phân tích nội dung Email sử dụng Gemini 1.5 Flash
 */
export const analyzeEmailWithAI = async (
    subject: string,
    bodyText: string,
    senderEmail: string
): Promise<AIAnalysisResult> => {
    // Kiểm tra API Key
    if (!process.env.GEMINI_API_KEY) {
        console.error('Lỗi: Cấu hình thiếu GEMINI_API_KEY.');
        return getFallbackResult(bodyText, 'Thiếu GEMINI_API_KEY trong .env');
    }

    try {
        // Tận dụng tính năng systemInstruction và temperature của Gemini 1.5
        const model = genAI.getGenerativeModel({
            model: 'gemini-1.5-flash',
            systemInstruction: `Bạn là trợ lý AI chuyên nghiệp phân tích và xử lý Email.
Nhiệm vụ của bạn là phân tích thông tin email được cung cấp và trả về DUY NHẤT một chuỗi JSON hợp lệ theo đúng schema được yêu cầu. Tuyệt đối không thêm bất kỳ đoạn văn bản giải thích nào ngoài JSON.`,
            generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.2, // Nhiệt độ thấp giúp phản hồi ổn định và chính xác hơn
            },
        });

        const prompt = `
Hãy phân tích Email dưới đây:

[Thông tin Email]
- Người gửi: ${senderEmail || 'Không rõ'}
- Tiêu đề: ${subject || 'Không có tiêu đề'}
- Nội dung: ${bodyText || 'Nội dung rỗng'}

[Yêu cầu định dạng JSON đầu ra]
{
  "aiCategory": "Tên phân loại (ví dụ: Work, Sales/Lead, Support, Phishing, General)",
  "isPhishing": true/false (chỉ bằng true nếu phát hiện dấu hiệu lừa đảo, mạo danh ngân hàng/tổ chức, đính kèm link/file độc hại),
  "phishingReason": "Giải thích ngắn gọn lý do bằng tiếng Việt nếu isPhishing = true, ngược lại để null",
  "isSpamOrPromo": true/false (true nếu là quảng cáo, email rác),
  "priorityScore": Số nguyên từ 1 đến 10 (10 là cực kỳ khẩn cấp hoặc nguy hiểm),
  "priorityReason": "Lý do đánh giá điểm ưu tiên bằng tiếng Việt",
  "aiSummary": "Tóm tắt nội dung email trong 1-2 câu tiếng Việt ngắn gọn",
  "suggestedReply": "Gợi ý câu trả lời tiếng Việt ngắn gọn lịch sự nếu email cần phản hồi, ngược lại để null"
}
`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text().trim();

        // Xử lý làm sạch chuỗi JSON phòng trường hợp AI tự động thêm bọc ```json ... ```
        const cleanJson = responseText
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();

        const parsedData = JSON.parse(cleanJson) as AIAnalysisResult;

        // Chuẩn hóa và ràng buộc dữ liệu đầu ra an toàn
        return {
            aiCategory: parsedData.aiCategory || 'General',
            isPhishing: Boolean(parsedData.isPhishing),
            phishingReason: parsedData.phishingReason || undefined,
            isSpamOrPromo: Boolean(parsedData.isSpamOrPromo),
            priorityScore: typeof parsedData.priorityScore === 'number'
                ? Math.min(Math.max(parsedData.priorityScore, 1), 10) // Ràng buộc trong đoạn [1, 10]
                : 5,
            priorityReason: parsedData.priorityReason || 'Đã phân tích tự động bởi AI',
            aiSummary: parsedData.aiSummary || (bodyText ? bodyText.slice(0, 100) + '...' : 'Không có tóm tắt'),
            suggestedReply: parsedData.suggestedReply || undefined,
        };

    } catch (error: any) {
        console.error('Lỗi khi gọi Gemini AI:', error?.message || error);
        return getFallbackResult(bodyText, 'Chưa phân tích được do lỗi AI service');
    }
};

/**
 * Hàm trả về kết quả dự phòng (Fallback) khi xảy ra lỗi
 */
const getFallbackResult = (bodyText: string, reason: string): AIAnalysisResult => {
    const safeBody = bodyText || '';
    return {
        aiCategory: 'Unclassified',
        isPhishing: false,
        isSpamOrPromo: false,
        priorityScore: 5,
        priorityReason: reason,
        aiSummary: safeBody ? safeBody.slice(0, 100) + '...' : 'Không có nội dung',
        suggestedReply: undefined,
    };
};