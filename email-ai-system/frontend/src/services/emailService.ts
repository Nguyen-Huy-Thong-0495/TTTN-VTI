import { api } from './api';
import { EmailItem } from '../types/email';

// Interface cho Response gửi email phản hồi
export interface SendReplyPayload {
    to: string;
    subject: string;
    replyContent: string;
    emailId?: string;
}

/**
 * 1. Lấy danh sách Email thuộc về User đang đăng nhập
 */
export const getEmails = async (): Promise<EmailItem[]> => {
    const response = await api.get<EmailItem[]>('/emails');
    return response.data;
};

/**
 * 2. Kích hoạt đồng bộ Email từ Server
 * Backend sẽ trả về danh sách email mới sau khi đồng bộ
 */
export const syncEmails = async (): Promise<EmailItem[]> => {
    const response = await api.post<{ message: string; data: EmailItem[] }>('/emails/sync');
    // Trả về trực tiếp mảng Email để Frontend cập nhật State ngay lập tức
    return response.data.data;
};

/**
 * 3. Cập nhật trạng thái Email (Pending, Resolved, SpamTrash...)
 */
export const updateEmailStatus = async (id: string, status: string): Promise<EmailItem> => {
    const response = await api.patch<EmailItem>(`/emails/${id}/status`, { status });
    return response.data;
};

/**
 * 4. Gửi email phản hồi
 */
export const sendReplyEmail = async (payload: SendReplyPayload): Promise<{ message: string }> => {
    const response = await api.post<{ message: string }>('/emails/send-reply', payload);
    return response.data;
};