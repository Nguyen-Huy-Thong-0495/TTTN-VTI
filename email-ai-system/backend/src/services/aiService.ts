import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

export const analyzeEmailWithAI = async (subject: any, bodyText: any, senderEmail: any) => {
    const MAX_RETRIES = 3;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            console.log(`[AI Service] Đang phân tích email... (lần thử ${attempt}/${MAX_RETRIES})`);

            const prompt = `
Bạn là hệ thống AI phân loại email thông minh.
Hãy phân tích thông tin email sau và CHỈ trả về một đối tượng JSON thuần túy hợp lệ, không bọc trong markdown (như \`\`\`json).

Thông tin email:
- Người gửi: ${senderEmail || 'Không rõ'}
- Tiêu đề: ${subject || 'Không có tiêu đề'}
- Nội dung: ${bodyText || 'Không có nội dung'}

Cấu trúc JSON bắt buộc:
{
    "aiCategory": "Work",
    "priorityScore": 5,
    "isPhishing": false,
    "isSpamOrPromo": false,
    "aiSummary": "Tóm tắt ngắn gọn nội dung email trong 1-2 câu",
    "suggestedReply": "Đề xuất câu trả lời lịch sự, chi tiết cho email này"
}

Quy tắc:
- aiCategory chỉ được phép chọn MỘT trong các giá trị: "Work", "Sales/Lead", "Support", "Phishing", "General".
- priorityScore là số nguyên từ 1 đến 10 (trong đó các email quan trọng/lừa đảo để từ 8-10, bình thường để 5).
- isPhishing: true nếu có dấu hiệu lừa đảo giả mạo, ngược lại false.
- isSpamOrPromo: true nếu là quảng cáo/spam, ngược lại false.
- suggestedReply: Phải có nội dung gợi ý trả lời chuyên nghiệp (trừ khi là lừa đảo/quảng cáo rác thì để trống).
`;

            const response = await ai.models.generateContent({
                model: 'gemini-1.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: 'application/json',
                    temperature: 0.1
                }
            });

            const responseText = response.text?.trim();
            if (!responseText) {
                throw new Error('Gemini trả về dữ liệu rỗng.');
            }

            const cleanJson = responseText
                .replace(/```json\s*/gi, '')
                .replace(/```\s*/gi, '')
                .trim();

            const result = JSON.parse(cleanJson);

            return {
                aiCategory: ['Work', 'Sales/Lead', 'Support', 'Phishing', 'General'].includes(result.aiCategory) 
                    ? result.aiCategory 
                    : 'General',
                priorityScore: typeof result.priorityScore === 'number' 
                    ? Math.min(Math.max(result.priorityScore, 1), 10) 
                    : 5,
                isPhishing: Boolean(result.isPhishing),
                isSpamOrPromo: Boolean(result.isSpamOrPromo),
                aiSummary: result.aiSummary || (bodyText ? bodyText.slice(0, 100) + '...' : 'Không có tóm tắt'),
                suggestedReply: result.suggestedReply || 'Cảm ơn bạn đã gửi email. Tôi đã nhận được thông tin và sẽ phản hồi sớm.'
            };

        } catch (err: any) {
            const error = err as any;
            const status = error?.status;
            console.error(`[AI Service] Lần thử ${attempt} thất bại:`, error?.message || error);

            const message = String(error?.message || '').toLowerCase();
            const isNetworkError = message.includes('fetch failed') || message.includes('network') || message.includes('timeout');
            const isTemporaryServerError = [408, 429, 500, 502, 503, 504].includes(status);

            if ((isNetworkError || isTemporaryServerError) && attempt < MAX_RETRIES) {
                const delay = Math.pow(2, attempt - 1) * 1000;
                console.log(`[AI Service] Thử lại sau ${delay / 1000}s...`);
                await sleep(delay);
                continue;
            }
            break;
        }
    }

    return {
        aiCategory: 'General',
        priorityScore: 5,
        isPhishing: false,
        isSpamOrPromo: false,
        aiSummary: bodyText ? bodyText.slice(0, 100) + '...' : 'Không có nội dung',
        suggestedReply: 'Cảm ơn bạn đã liên hệ.'
    };
};