import { api } from './api';
import { EmailItem } from '../types/email';

// 1. Lấy danh sách Email từ Backend
export const getEmails = async (): Promise<EmailItem[]> => {
    const response = await api.get('/emails');
    return response.data;
};

// 2. Kích hoạt đồng bộ Email từ Gmail/Outlook
export const syncEmails = async (): Promise<void> => {
    await api.post('/emails/sync');
};

// 3. Cập nhật trạng thái Email (Pending, Resolved, SpamTrash)
export const updateEmailStatus = async (id: string, status: string): Promise<EmailItem> => {
    const response = await api.patch(`/emails/${id}/status`, { status });
    return response.data;
};

// 4. Gửi email phản hồi do AI gợi ý
export const sendReplyEmail = async (id: string, replyMessage: string): Promise<void> => {
    await api.post(`/emails/${id}/reply`, { replyMessage });
};