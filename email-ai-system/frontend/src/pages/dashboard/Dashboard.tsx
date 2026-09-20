import { useEffect, useState } from 'react';
import {
    ShieldAlert,
    Sparkles,
    Send,
    AlertTriangle,
    RefreshCw,
    Loader2,
    CheckCircle
} from 'lucide-react';
import { EmailItem } from '../../types/email';
import { getEmails, syncEmails, sendReplyEmail } from '../../services/emailService';

export const Dashboard = () => {
    const [emails, setEmails] = useState<EmailItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [syncing, setSyncing] = useState<boolean>(false);

    // State quản lý ID của email đang được gửi phản hồi
    const [sendingId, setSendingId] = useState<string | null>(null);

    // Hàm tải danh sách Email từ Backend
    const fetchEmails = async () => {
        try {
            setLoading(true);
            const data = await getEmails();
            setEmails(data);
        } catch (error) {
            console.error('Lỗi khi tải dữ liệu Email:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEmails();
    }, []);

    // Hàm xử lý nút "Đồng bộ Email"
    const handleSync = async () => {
        try {
            setSyncing(true);
            await syncEmails();
            await fetchEmails(); // Tải lại danh sách sau khi đồng bộ
        } catch (error) {
            console.error('Lỗi khi đồng bộ Email:', error);
        } finally {
            setSyncing(false);
        }
    };

    // Hàm xử lý nút "Gửi phản hồi"
    const handleSendReply = async (email: EmailItem) => {
        if (!email.suggestedReply) {
            alert('Email này chưa có gợi ý phản hồi từ AI!');
            return;
        }

        console.log('>>> Tiến hành gửi email phản hồi:', {
            to: email.sender.email,
            subject: email.subject,
            id: email._id
        });

        try {
            setSendingId(email._id);

            // Truyền đủ 4 tham số: người nhận, tiêu đề, nội dung, và ID email để update MongoDB
            await sendReplyEmail(
                email.sender.email,
                email.subject,
                email.suggestedReply,
                email._id
            );

            alert(`✅ Đã gửi email phản hồi thành công tới ${email.sender.email}!`);
            await fetchEmails(); // Cập nhật lại danh sách và trạng thái trong MongoDB
        } catch (error: any) {
            console.error('Lỗi khi gửi phản hồi:', error);
            alert(`❌ Lỗi gửi email: ${error.response?.data?.message || error.message || 'Vui lòng kiểm tra lại EMAIL_USER / EMAIL_PASS trong file backend/.env!'}`);
        } finally {
            setSendingId(null);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 p-6">
            {/* Header */}
            <header className="max-w-6xl mx-auto flex justify-between items-center pb-6 border-b border-slate-800 mb-8">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-600 rounded-xl text-white">
                        <Sparkles size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight">AI Email Smart Agent</h1>
                        <p className="text-xs text-slate-400">Hệ thống phân loại & xử lý Email tự động</p>
                    </div>
                </div>
                <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition cursor-pointer"
                >
                    <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
                    {syncing ? 'Đang đồng bộ...' : 'Đồng bộ Email'}
                </button>
            </header>

            {/* Main Content */}
            <main className="max-w-6xl mx-auto space-y-4">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <Loader2 size={32} className="animate-spin mb-2" />
                        <p className="text-sm">Đang tải danh sách email...</p>
                    </div>
                ) : emails.length === 0 ? (
                    <div className="text-center py-20 text-slate-400 bg-slate-800/40 rounded-2xl border border-slate-700/50">
                        <p className="text-base font-medium">Chưa có email nào trong hệ thống</p>
                        <p className="text-xs text-slate-500 mt-1">Nhấn "Đồng bộ Email" để kiểm tra thư mới.</p>
                    </div>
                ) : (
                    emails.map((email) => (
                        <div
                            key={email._id}
                            className={`p-5 rounded-2xl border transition-all duration-200 ${email.isPhishing
                                ? 'bg-red-950/20 border-red-800/50 hover:border-red-700'
                                : 'bg-slate-800/60 border-slate-700/60 hover:border-slate-600'
                                }`}
                        >
                            {/* Top Badge & Status Bar */}
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                                <div className="flex items-center gap-2">
                                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${email.priorityScore >= 8
                                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                        : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                                        }`}>
                                        Độ ưu tiên: {email.priorityScore}/10
                                    </span>

                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-700 text-slate-300">
                                        {email.aiCategory}
                                    </span>

                                    {email.isPhishing && (
                                        <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white animate-pulse">
                                            <ShieldAlert size={14} /> CẢNH BÁO LỪA ĐẢO
                                        </span>
                                    )}

                                    {email.isAutoReplied && (
                                        <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                            <CheckCircle size={13} /> Đã phản hồi
                                        </span>
                                    )}
                                </div>

                                <span className="text-xs text-slate-400">
                                    {new Date(email.receivedAt).toLocaleString('vi-VN')}
                                </span>
                            </div>

                            {/* Subject & Sender */}
                            <h2 className="text-lg font-semibold text-slate-100 mb-1">{email.subject}</h2>
                            <p className="text-xs text-slate-400 mb-4">
                                Người gửi: <span className="text-slate-300 font-medium">{email.sender.name}</span> ({email.sender.email})
                            </p>

                            {/* AI Summary Box */}
                            <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-700/50 mb-3">
                                <p className="text-xs font-semibold text-indigo-400 flex items-center gap-1.5 mb-1">
                                    <Sparkles size={14} /> Tóm tắt từ AI:
                                </p>
                                <p className="text-sm text-slate-300 leading-relaxed">{email.aiSummary}</p>
                                {email.phishingReason && (
                                    <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
                                        <AlertTriangle size={13} /> Lý do cảnh báo: {email.phishingReason}
                                    </p>
                                )}
                            </div>

                            {/* AI Suggested Reply */}
                            {email.suggestedReply && (
                                <div className="p-3 bg-indigo-950/30 rounded-xl border border-indigo-900/40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                    <p className="text-xs text-indigo-200">
                                        <strong className="text-indigo-400">Gợi ý trả lời:</strong> "{email.suggestedReply}"
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => handleSendReply(email)}
                                        disabled={sendingId === email._id || email.isAutoReplied}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition shrink-0 cursor-pointer"
                                    >
                                        {sendingId === email._id ? (
                                            <>
                                                <Loader2 size={13} className="animate-spin" /> Đang gửi...
                                            </>
                                        ) : email.isAutoReplied ? (
                                            <>
                                                <CheckCircle size={13} /> Đã gửi
                                            </>
                                        ) : (
                                            <>
                                                <Send size={13} /> Gửi phản hồi
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </main>
        </div>
    );
};