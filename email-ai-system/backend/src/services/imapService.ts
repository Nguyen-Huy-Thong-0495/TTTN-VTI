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
 * Kết nối tới Gmail IMAP và tải 10 email mới nhất từ hòm thư INBOX cho từng User cụ thể
 * @param emailAddress Địa chỉ Gmail của user
 * @param appPassword Mật khẩu ứng dụng 16 ký tự của user
 */
export const fetchRealEmailsFromIMAP = async (
    emailAddress?: string,
    appPassword?: string
): Promise<FetchedEmailData[]> => {
    // Ưu tiên dùng cấu hình cá nhân của User, nếu không có mới dùng biến môi trường .env
    const user = emailAddress || process.env.EMAIL_USER;
    const pass = appPassword || process.env.EMAIL_PASS;

    if (!user || !pass) {
        console.warn('⚠️ Chưa cấu hình Email hoặc App Password cho người dùng này.');
        return [];
    }

    const client = new ImapFlow({
        host: 'imap.gmail.com',
        port: 993,
        secure: true,
        auth: { user, pass },
        logger: false, // Tắt log chi tiết của ImapFlow
        emitLogs: false,
    });

    const fetchedEmails: FetchedEmailData[] = [];

    try {
        await client.connect();
        console.log(`✅ Kết nối IMAP thành công tới hòm thư: ${user}`);

        // Mở hòm thư INBOX
        const lock = await client.getMailboxLock('INBOX');
        try {
            const status = client.mailbox;
            if (!status || status.exists === 0) {
                console.log(`ℹ️ Hòm thư INBOX của ${user} đang trống.`);
                return [];
            }

            // Lấy tối đa 10 email mới nhất trong hòm thư
            const totalEmails = status.exists;
            const startSeq = Math.max(1, totalEmails - 9);
            const range = `${startSeq}:${totalEmails}`;

            // Duyệt và lấy nội dung email thô
            for await (const message of client.fetch(range, { source: true, envelope: true })) {
                if (!message.source) continue;

                try {
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
                } catch (parseError) {
                    console.error(`Lỗi khi parse tin nhắn sequence ${message.seq}:`, parseError);
                }
            }
        } finally {
            // Giải phóng khóa hòm thư
            lock.release();
        }

        await client.logout();
    } catch (error) {
        console.error(`❌ Lỗi khi tải email qua IMAP cho ${user}:`, error);
        try {
            await client.logout();
        } catch (_) {}
        throw error;
    }

    return fetchedEmails;
};

/**
 * Lắng nghe Email mới theo Thời gian thực (Real-time IMAP IDLE) cho một User
 * @param emailAddress Gmail user
 * @param appPassword App Password user
 * @param onNewEmailCallback Hàm callback xử lý ngay khi có thư mới tới
 */
export const startIMAPIdleForUser = async (
    emailAddress: string,
    appPassword: string,
    onNewEmailCallback: (email: FetchedEmailData) => Promise<void>
) => {
    const client = new ImapFlow({
        host: 'imap.gmail.com',
        port: 993,
        secure: true,
        auth: {
            user: emailAddress,
            pass: appPassword,
        },
        logger: false,
        emitLogs: false,
    });

    try {
        await client.connect();
        console.log(`🎧 Đang lắng nghe Email Real-time cho: ${emailAddress}`);

        const lock = await client.getMailboxLock('INBOX');

        // Sự kiện khi nhận thông báo có email mới (exists event)
        client.on('exists', async (data) => {
            console.log(`📩 Phát hiện email mới tới hòm thư ${emailAddress}! (Mã tin: ${data.count})`);
            try {
                // Tải email mới nhất (vừa tới)
                for await (const message of client.fetch(`${data.count}`, { source: true })) {
                    if (!message.source) continue;
                    const parsed: ParsedMail = await simpleParser(message.source);
                    const senderObj = parsed.from?.value[0];

                    const newEmail: FetchedEmailData = {
                        messageId: parsed.messageId || `imap-idle-${Date.now()}`,
                        sender: {
                            name: senderObj?.name || senderObj?.address?.split('@')[0] || 'Chưa rõ',
                            email: senderObj?.address || 'unknown@example.com',
                        },
                        subject: parsed.subject || '(Không có tiêu đề)',
                        bodyText: parsed.text || '',
                        receivedAt: parsed.date || new Date(),
                    };

                    // Gọi callback lưu vào DB & Gemini AI tự động trả lời
                    await onNewEmailCallback(newEmail);
                }
            } catch (err) {
                console.error(`Lỗi xử lý email mới Real-time cho ${emailAddress}:`, err);
            }
        });

        // Giữ kết nối ngầm (IDLE)
        await client.idle();

        // Tự động nhả lock khi thoát
        lock.release();
    } catch (error) {
        console.error(`Lỗi kết nối IMAP IDLE cho ${emailAddress}:`, error);
    }
};