import { ImapFlow } from 'imapflow';
import { simpleParser, ParsedMail } from 'mailparser';

export interface FetchedEmailData {
    messageId: string;
    sender: {
        name: string;
        email: string;
    };
    subject: string;
    bodyText: string;
    receivedAt: Date;
}

/**
 * Kết nối tới Gmail IMAP và tải 10 email mới nhất từ hòm thư INBOX
 */
export const fetchRealEmailsFromIMAP = async (): Promise<FetchedEmailData[]> => {
    const client = new ImapFlow({
        host: 'imap.gmail.com',
        port: 993,
        secure: true,
        auth: {
            user: process.env.EMAIL_USER!,
            pass: process.env.EMAIL_PASS!,
        },
        logger: false, // Tắt log chi tiết của ImapFlow
    });

    const fetchedEmails: FetchedEmailData[] = [];

    try {
        await client.connect();
        console.log('✅ Kết nối thành công tới Gmail IMAP!');

        // Mở hòm thư INBOX
        const lock = await client.getMailboxLock('INBOX');
        try {
            const status = client.mailbox;
            if (!status || status.exists === 0) {
                console.log('ℹ️ Hòm thư INBOX trống.');
                return [];
            }

            // Lấy tối đa 10 email mới nhất trong hòm thư
            const totalEmails = status.exists;
            const startSeq = Math.max(1, totalEmails - 9);
            const range = `${startSeq}:${totalEmails}`;

            // Duyệt và lấy nội dung email thô
            for await (const message of client.fetch(range, { source: true, envelope: true })) {
                if (!message.source) continue;

                // Dùng mailparser bóc tách nội dung email thô
                const parsed: ParsedMail = await simpleParser(message.source);

                const senderObj = parsed.from?.value[0];
                const senderName = senderObj?.name || senderObj?.address?.split('@')[0] || 'Chưa rõ';
                const senderEmail = senderObj?.address || 'unknown@example.com';

                // Bóc tách nội dung HTML an toàn (tránh lỗi type 'false' của mailparser)
                const htmlText = typeof parsed.html === 'string' 
                    ? parsed.html.replace(/<[^>]+>/g, '') 
                    : '';

                fetchedEmails.push({
                    messageId: parsed.messageId || `imap-${message.uid}-${Date.now()}`,
                    sender: {
                        name: senderName,
                        email: senderEmail,
                    },
                    subject: parsed.subject || '(Không có tiêu đề)',
                    bodyText: parsed.text || htmlText || '',
                    receivedAt: parsed.date || new Date(),
                });
            }
        } finally {
            // Giải phóng khóa hòm thư
            lock.release();
        }

        await client.logout();
    } catch (error) {
        console.error('❌ Lỗi khi tải email qua IMAP:', error);
        try {
            await client.logout();
        } catch (_) {}
        throw error;
    }

    return fetchedEmails;
};