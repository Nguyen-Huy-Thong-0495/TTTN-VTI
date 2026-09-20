import nodemailer from 'nodemailer';
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

export const sendReplyEmail = async (to: string, subject: string, text: string) => {
    try {
        // Kiểm tra để tránh trùng lặp "Re: Re: ..."
        const cleanSubject = subject || '';
        const formattedSubject = cleanSubject.startsWith('Re:') 
            ? cleanSubject 
            : `Re: ${cleanSubject}`;

        const mailOptions = {
            from: `"AI Email Smart Agent" <${process.env.EMAIL_USER}>`,
            to,
            subject: formattedSubject,
            text,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email đã được gửi thành công:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Lỗi khi gửi email:', error);
        throw error;
    }
};