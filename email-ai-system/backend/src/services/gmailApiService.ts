import axios from 'axios';

/**
 * Lấy danh sách email trực tiếp từ Gmail API sử dụng Google Access Token
 */
export const fetchEmailsFromGmailApi = async (accessToken: string) => {
    try {
        // 1. Lấy danh sách message ID từ Gmail API (lấy tối đa 20 email mới nhất)
        const listRes = await axios.get(
            'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20',
            {
                headers: { Authorization: `Bearer ${accessToken}` }
            }
        );

        const messages = listRes.data.messages || [];
        const detailedEmails = [];

        // 2. Duyệt qua từng message để lấy nội dung chi tiết (Tiêu đề, Người gửi, Nội dung, Thời gian)
        for (const msg of messages) {
            const detailRes = await axios.get(
                `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
                {
                    headers: { Authorization: `Bearer ${accessToken}` }
                }
            );

            const data = detailRes.data;
            const headers = data.payload.headers;

            // Trích xuất các trường quan trọng từ header
            const subjectHeader = headers.find((h: any) => h.name.toLowerCase() === 'subject');
            const fromHeader = headers.find((h: any) => h.name.toLowerCase() === 'from');
            const dateHeader = headers.find((h: any) => h.name.toLowerCase() === 'date');

            const subject = subjectHeader ? subjectHeader.value : '(Không có tiêu đề)';
            const fromValue = fromHeader ? fromHeader.value : '';
            
            // Xách định tên và email của người gửi từ chuỗi dạng "Name <email@gmail.com>"
            let senderName = fromValue;
            let senderEmail = fromValue;
            const match = fromValue.match(/(.+?)\s*<(.+?)>/);
            if (match) {
                senderName = match[1].replace(/"/g, '').trim();
                senderEmail = match[2].trim();
            }

            // Lấy đoạn snippet (nội dung rút gọn) làm bodyText
            const bodyText = data.snippet || '';

            detailedEmails.push({
                messageId: data.id,
                sender: {
                    name: senderName,
                    email: senderEmail,
                },
                subject,
                bodyText,
                receivedAt: dateHeader ? new Date(dateHeader.value) : new Date(),
            });
        }

        return detailedEmails;
    } catch (error: any) {
        console.error('Lỗi khi gọi Gmail API:', error.response?.data || error.message);
        throw new Error('Không thể đồng bộ email từ tài khoản Google. Token có thể đã hết hạn.');
    }
};