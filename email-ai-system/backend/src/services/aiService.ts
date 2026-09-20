import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

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

export const analyzeEmailWithAI = async (
    subject: string,
    bodyText: string,
    senderEmail: string
): Promise<AIAnalysisResult> => {
    try {
        const model = genAI.getGenerativeModel({
            model: 'gemini-1.5-flash',
            generationConfig: { responseMimeType: 'application/json' }
        });

        const prompt = `
    Bạn là một trợ lý AI chuyên nghiệp phân tích và xử lý Email.
    Hãy phân tích Email dưới đây và trả về kết quả theo ĐÚNG định dạng JSON schema:

    Thông tin Email:
    - Người gửi: ${senderEmail}
    - Tiêu đề: ${subject}
    - Nội dung: ${bodyText}

    Yêu cầu đầu ra JSON có cấu trúc chính xác như sau:
    {
      "aiCategory": "Tên phân loại (ví dụ: Work, Sales/Lead, Support, Phishing, General)",
      "isPhishing": true/false (chỉ bằng true nếu phát hiện dấu hiệu lừa đảo, giả mạo ngân hàng/tổ chức, đính kèm link/file độc hại),
      "phishingReason": "Giải thích ngắn gọn lý do nếu isPhishing = true, ngược lại để null",
      "isSpamOrPromo": true/false (true nếu là quảng cáo, spam),
      "priorityScore": Số nguyên từ 1 đến 10 (10 là cực kỳ khẩn cấp hoặc lừa đảo),
      "priorityReason": "Lý do đánh giá điểm ưu tiên",
      "aiSummary": "Tóm tắt nội dung email trong 1-2 câu tiếng Việt ngắn gọn",
      "suggestedReply": "Gợi ý câu trả lời tiếng Việt ngắn gọn lịch sự nếu email cần phản hồi, ngược lại để null"
    }
    `;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        return JSON.parse(responseText) as AIAnalysisResult;
    } catch (error) {
        console.error('Lỗi khi gọi Gemini AI:', error);
        // Trả về fallback mặc định nếu AI gặp lỗi
        return {
            aiCategory: 'Unclassified',
            isPhishing: false,
            isSpamOrPromo: false,
            priorityScore: 5,
            priorityReason: 'Chưa phân tích được do lỗi AI service',
            aiSummary: bodyText.slice(0, 100) + '...',
        };
    }
};