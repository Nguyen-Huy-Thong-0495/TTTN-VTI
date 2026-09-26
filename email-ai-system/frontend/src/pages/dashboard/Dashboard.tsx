import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
    ShieldAlert,
    Sparkles,
    Send,
    AlertTriangle,
    RefreshCw,
    Loader2,
    CheckCircle,
    LogOut,
    User,
    Clock,
    Inbox,
    MailCheck,
    Search,
    ChevronDown,
    ChevronUp,
    Edit3,
    X,
    Check
} from 'lucide-react';
import { EmailItem } from '../../types/email';
import { getEmails, syncEmails, sendReplyEmail } from '../../services/emailService';

interface DashboardProps {
    onLogout?: () => void;
}

type FilterType = 'all' | 'highPriority' | 'phishing' | 'replied';

export const Dashboard = ({ onLogout }: DashboardProps) => {
    // --- States ---
    const [emails, setEmails] = useState<EmailItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [manualSyncing, setManualSyncing] = useState<boolean>(false);
    const [silentSyncing, setSilentSyncing] = useState<boolean>(false);
    const [sendingId, setSendingId] = useState<string | null>(null);
    const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

    // Search & Filter States
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [activeFilter, setActiveFilter] = useState<FilterType>('all');
    const [expandedEmailId, setExpandedEmailId] = useState<string | null>(null);

    // Inline Editing for AI Reply
    const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
    const [editedReplyText, setEditedReplyText] = useState<string>('');

    const isMounted = useRef<boolean>(true);

    // Lazy initialization cho currentUser
    const [currentUser] = useState(() => {
        try {
            const stored = localStorage.getItem('user');
            return stored ? JSON.parse(stored) : null;
        } catch {
            return null;
        }
    });

    // Helper ép kiểu dữ liệu mảng an toàn từ nhiều định dạng Backend trả về
    const extractEmailList = (data: any): EmailItem[] => {
        if (!data) return [];
        if (Array.isArray(data)) return data;
        if (Array.isArray(data.emails)) return data.emails;
        if (Array.isArray(data.data)) return data.data;
        if (data.data && Array.isArray(data.data.emails)) return data.data.emails;
        if (Array.isArray(data.items)) return data.items;
        if (Array.isArray(data.result)) return data.result;
        return [];
    };

    // Tải dữ liệu từ Database
    const fetchEmailsFromDB = useCallback(async (isInitial = false) => {
        try {
            if (isInitial) setLoading(true);
            const rawData = await getEmails();
            if (isMounted.current) {
                const list = extractEmailList(rawData);
                setEmails(list);
            }
        } catch (error) {
            console.error('Lỗi khi tải danh sách email:', error);
        } finally {
            if (isInitial && isMounted.current) {
                setLoading(false);
            }
        }
    }, []);

    // Đồng bộ Email từ Mail Server
    const performSync = useCallback(async (isSilent = false) => {
        if (isSilent) {
            setSilentSyncing(true);
        } else {
            setManualSyncing(true);
        }

        try {
            const syncResult = await syncEmails();
            const extracted = extractEmailList(syncResult);

            if (extracted.length > 0) {
                if (isMounted.current) setEmails(extracted);
            } else {
                await fetchEmailsFromDB(false);
            }

            if (isMounted.current) {
                setLastSyncedAt(new Date());
            }
        } catch (error) {
            console.error('Lỗi khi đồng bộ email:', error);
            if (isMounted.current) {
                await fetchEmailsFromDB(false);
            }
        } finally {
            if (isMounted.current) {
                if (isSilent) {
                    setSilentSyncing(false);
                } else {
                    setManualSyncing(false);
                }
            }
        }
    }, [fetchEmailsFromDB]);

    // Polling ngầm mỗi 30 giây
    useEffect(() => {
        isMounted.current = true;

        const initLoad = async () => {
            await fetchEmailsFromDB(true);
            if (isMounted.current) {
                await performSync(true);
            }
        };

        initLoad();

        const POLLING_INTERVAL = 30000;
        const timer = setInterval(() => {
            if (isMounted.current) {
                console.log('🔄 [Polling] Tự động kiểm tra email mới...');
                performSync(true);
            }
        }, POLLING_INTERVAL);

        return () => {
            isMounted.current = false;
            clearInterval(timer);
        };
    }, [fetchEmailsFromDB, performSync]);

    // Bắt đầu chỉnh sửa nội dung phản hồi AI
    const handleStartEditing = (emailId: string, currentReply: string) => {
        setEditingReplyId(emailId);
        setEditedReplyText(currentReply);
    };

    const handleCancelEditing = () => {
        setEditingReplyId(null);
        setEditedReplyText('');
    };

    const handleSaveEditing = (emailId: string) => {
        setEmails((prev) =>
            prev.map((item) =>
                (item._id === emailId || item.id === emailId)
                    ? { ...item, suggestedReply: editedReplyText }
                    : item
            )
        );
        setEditingReplyId(null);
    };

    // Xử lý Phản hồi Email
    const handleSendReply = async (email: EmailItem) => {
        const targetId = email._id || email.id || '';
        const replyText = editingReplyId === targetId ? editedReplyText : email.suggestedReply;

        if (!replyText || !replyText.trim()) {
            alert('Nội dung phản hồi không được để trống!');
            return;
        }

        const senderEmail = typeof email.sender === 'string' ? email.sender : email.sender?.email || '';

        try {
            setSendingId(targetId);

            await sendReplyEmail({
                to: senderEmail,
                subject: email.subject,
                replyContent: replyText,
                emailId: targetId,
            });

            alert(`Đã gửi email phản hồi thành công tới ${senderEmail}!`);
            setEditingReplyId(null);
            await fetchEmailsFromDB(false);
        } catch (error: any) {
            console.error('Lỗi khi gửi phản hồi:', error);
            alert(
                `Lỗi gửi email: ${
                    error.response?.data?.message ||
                    error.message ||
                    'Vui lòng kiểm tra lại cấu hình tài khoản!'
                }`
            );
        } finally {
            if (isMounted.current) setSendingId(null);
        }
    };

    // Tính toán Thống kê
    const stats = useMemo(() => {
        const safeList = Array.isArray(emails) ? emails : [];
        return {
            total: safeList.length,
            phishing: safeList.filter((e) => e.isPhishing).length,
            replied: safeList.filter((e) => e.isAutoReplied).length,
            highPriority: safeList.filter((e) => (e.priorityScore || 0) >= 8).length,
        };
    }, [emails]);

    // Lọc và Tìm kiếm danh sách Email
    const filteredEmails = useMemo(() => {
        const safeList = Array.isArray(emails) ? emails : [];
        return safeList.filter((email) => {
            const senderName = typeof email.sender === 'object' ? email.sender?.name || '' : '';
            const senderEmail = typeof email.sender === 'object' ? email.sender?.email || '' : (email.sender || '');

            const matchesSearch =
                (email.subject || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                senderName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                senderEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (email.aiSummary || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (email.bodyText || '').toLowerCase().includes(searchQuery.toLowerCase());

            if (!matchesSearch) return false;

            if (activeFilter === 'highPriority') return (email.priorityScore || 0) >= 8;
            if (activeFilter === 'phishing') return !!email.isPhishing;
            if (activeFilter === 'replied') return !!email.isAutoReplied;

            return true;
        });
    }, [emails, searchQuery, activeFilter]);

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-6">
            {/* Top Navigation Header */}
            <header className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-slate-800 mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-600/30">
                        <Sparkles size={24} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-bold tracking-tight text-white">
                                AI Email Smart Agent
                            </h1>
                            {silentSyncing && (
                                <span className="flex items-center gap-1 text-[11px] text-indigo-400 bg-indigo-950/60 border border-indigo-800/50 px-2.5 py-0.5 rounded-full animate-pulse">
                                    <RefreshCw size={10} className="animate-spin" /> Đang cập nhật...
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-slate-400">
                            Hệ thống phân loại & xử lý Email tự động theo thời gian thực
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                    {lastSyncedAt && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-700/50">
                            <Clock size={13} className="text-indigo-400" />
                            <span>
                                Cập nhật:{' '}
                                <strong className="text-slate-300">
                                    {lastSyncedAt.toLocaleTimeString('vi-VN')}
                                </strong>
                            </span>
                        </div>
                    )}

                    {currentUser && (
                        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-slate-800 border border-slate-700/60 rounded-lg text-xs text-slate-300">
                            <User size={14} className="text-indigo-400" />
                            <span>{currentUser.name || currentUser.email}</span>
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={() => performSync(false)}
                        disabled={manualSyncing || silentSyncing}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition cursor-pointer shadow-md shadow-indigo-600/20"
                    >
                        <RefreshCw size={16} className={manualSyncing ? 'animate-spin' : ''} />
                        {manualSyncing ? 'Đang đồng bộ...' : 'Đồng bộ ngay'}
                    </button>

                    {onLogout && (
                        <button
                            type="button"
                            onClick={onLogout}
                            title="Đăng xuất"
                            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 border border-transparent hover:border-slate-700 rounded-lg transition"
                        >
                            <LogOut size={18} />
                        </button>
                    )}
                </div>
            </header>

            {/* Quick Stats Bar */}
            {!loading && (
                <div className="max-w-6xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                    <button
                        type="button"
                        onClick={() => setActiveFilter('all')}
                        className={`p-3.5 rounded-xl border flex items-center justify-between text-left transition ${
                            activeFilter === 'all'
                                ? 'bg-indigo-950/40 border-indigo-500/50 ring-1 ring-indigo-500/30'
                                : 'bg-slate-800/40 border-slate-800 hover:border-slate-700'
                        }`}
                    >
                        <div>
                            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                                Tổng hòm thư
                            </p>
                            <p className="text-xl font-bold text-slate-100">{stats.total}</p>
                        </div>
                        <Inbox size={20} className="text-indigo-400" />
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveFilter('highPriority')}
                        className={`p-3.5 rounded-xl border flex items-center justify-between text-left transition ${
                            activeFilter === 'highPriority'
                                ? 'bg-amber-950/40 border-amber-500/50 ring-1 ring-amber-500/30'
                                : 'bg-slate-800/40 border-slate-800 hover:border-slate-700'
                        }`}
                    >
                        <div>
                            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                                Khẩn cấp (8-10)
                            </p>
                            <p className="text-xl font-bold text-amber-400">{stats.highPriority}</p>
                        </div>
                        <AlertTriangle size={20} className="text-amber-400" />
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveFilter('phishing')}
                        className={`p-3.5 rounded-xl border flex items-center justify-between text-left transition ${
                            activeFilter === 'phishing'
                                ? 'bg-rose-950/40 border-rose-500/50 ring-1 ring-rose-500/30'
                                : 'bg-slate-800/40 border-slate-800 hover:border-slate-700'
                        }`}
                    >
                        <div>
                            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                                Cảnh báo lừa đảo
                            </p>
                            <p className="text-xl font-bold text-rose-400">{stats.phishing}</p>
                        </div>
                        <ShieldAlert size={20} className="text-rose-400" />
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveFilter('replied')}
                        className={`p-3.5 rounded-xl border flex items-center justify-between text-left transition ${
                            activeFilter === 'replied'
                                ? 'bg-emerald-950/40 border-emerald-500/50 ring-1 ring-emerald-500/30'
                                : 'bg-slate-800/40 border-slate-800 hover:border-slate-700'
                        }`}
                    >
                        <div>
                            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                                Đã phản hồi
                            </p>
                            <p className="text-xl font-bold text-emerald-400">{stats.replied}</p>
                        </div>
                        <MailCheck size={20} className="text-emerald-400" />
                    </button>
                </div>
            )}

            {/* Controls Bar */}
            {!loading && emails.length > 0 && (
                <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 mb-4">
                    <div className="relative w-full sm:w-80">
                        <Search
                            size={16}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                            type="text"
                            placeholder="Tìm kiếm email, tóm tắt, người gửi..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-800/80 border border-slate-700 text-slate-200 placeholder-slate-400 text-xs rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:border-indigo-500 transition"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    <div className="text-xs text-slate-400 flex items-center gap-2 self-end sm:self-auto">
                        <span>
                            Hiển thị: <strong className="text-slate-200">{filteredEmails.length}</strong> / {emails.length} email
                        </span>
                        {activeFilter !== 'all' && (
                            <button
                                type="button"
                                onClick={() => setActiveFilter('all')}
                                className="text-indigo-400 hover:underline text-xs cursor-pointer"
                            >
                                (Bỏ lọc)
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Main Content List */}
            <main className="max-w-6xl mx-auto space-y-4">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <Loader2 size={32} className="animate-spin text-indigo-500 mb-3" />
                        <p className="text-sm">Đang kết nối và tải danh sách email...</p>
                    </div>
                ) : filteredEmails.length === 0 ? (
                    <div className="text-center py-20 text-slate-400 bg-slate-800/40 rounded-2xl border border-slate-700/50 p-6">
                        <p className="text-base font-medium text-slate-300">
                            {searchQuery || activeFilter !== 'all'
                                ? 'Không tìm thấy email nào phù hợp với bộ lọc'
                                : 'Chưa có email nào trong hòm thư'}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                            Hệ thống đang tự động kiểm tra thư mới mỗi 30 giây hoặc bạn có thể bấm "Đồng bộ ngay".
                        </p>
                    </div>
                ) : (
                    filteredEmails.map((email) => {
                        const emailId = email._id || email.id || '';
                        const isExpanded = expandedEmailId === emailId;
                        const isEditing = editingReplyId === emailId;
                        const isSending = sendingId === emailId;

                        const senderName = typeof email.sender === 'object' ? email.sender?.name : 'Không rõ';
                        const senderEmail = typeof email.sender === 'object' ? email.sender?.email : (email.sender || 'N/A');

                        return (
                            <div
                                key={emailId}
                                className={`p-5 rounded-2xl border transition-all duration-200 ${
                                    email.isPhishing
                                        ? 'bg-red-950/20 border-red-800/50 hover:border-red-700'
                                        : 'bg-slate-800/60 border-slate-700/60 hover:border-slate-600'
                                }`}
                            >
                                {/* Badges Bar */}
                                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span
                                            className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                                (email.priorityScore || 0) >= 8
                                                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                                    : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                                            }`}
                                        >
                                            Độ ưu tiên: {email.priorityScore || 5}/10
                                        </span>
                                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-700 text-slate-300 border border-slate-600/50">
                                            {email.aiCategory || 'Unclassified'}
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
                                    <span className="text-xs text-slate-400 font-mono">
                                        {email.receivedAt
                                            ? new Date(email.receivedAt).toLocaleString('vi-VN')
                                            : ''}
                                    </span>
                                </div>

                                {/* Subject & Sender */}
                                <div className="flex justify-between items-start gap-4 mb-1">
                                    <h2 className="text-lg font-semibold text-slate-100 leading-snug">
                                        {email.subject || 'Không có tiêu đề'}
                                    </h2>
                                    {email.bodyText && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setExpandedEmailId(isExpanded ? null : emailId)
                                            }
                                            className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 shrink-0 font-medium cursor-pointer"
                                        >
                                            {isExpanded ? (
                                                <>
                                                    Ẩn nội dung <ChevronUp size={14} />
                                                </>
                                            ) : (
                                                <>
                                                    Xem nội dung gốc <ChevronDown size={14} />
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>

                                <p className="text-xs text-slate-400 mb-4">
                                    Người gửi:{' '}
                                    <span className="text-slate-300 font-medium">
                                        {senderName}
                                    </span>{' '}
                                    ({senderEmail})
                                </p>

                                {/* Full Email Body Text Expansion */}
                                {isExpanded && email.bodyText && (
                                    <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 text-xs text-slate-300 whitespace-pre-wrap leading-relaxed mb-4 font-sans">
                                        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 border-b border-slate-800 pb-1">
                                            Nội dung email chi tiết:
                                        </div>
                                        {email.bodyText}
                                    </div>
                                )}

                                {/* AI Summary Box */}
                                <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-700/50 mb-3">
                                    <p className="text-xs font-semibold text-indigo-400 flex items-center gap-1.5 mb-1">
                                        <Sparkles size={14} /> Tóm tắt từ AI:
                                    </p>
                                    <p className="text-sm text-slate-300 leading-relaxed">
                                        {email.aiSummary || 'Không có tóm tắt'}
                                    </p>
                                    {email.phishingReason && (
                                        <p className="text-xs text-red-400 mt-2 flex items-center gap-1 border-t border-red-900/30 pt-2">
                                            <AlertTriangle size={13} className="shrink-0" /> Lý do cảnh báo:{' '}
                                            {email.phishingReason}
                                        </p>
                                    )}
                                </div>

                                {/* AI Suggested Reply Box */}
                                {email.suggestedReply && (
                                    <div className="p-3.5 bg-indigo-950/30 rounded-xl border border-indigo-900/40 space-y-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-xs font-semibold text-indigo-400 flex items-center gap-1.5">
                                                <Send size={13} /> Gợi ý trả lời tự động:
                                            </p>
                                            {!email.isAutoReplied && !isEditing && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleStartEditing(
                                                            emailId,
                                                            email.suggestedReply || ''
                                                        )
                                                    }
                                                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-indigo-300 transition cursor-pointer"
                                                >
                                                    <Edit3 size={12} /> Chỉnh sửa
                                                </button>
                                            )}
                                        </div>

                                        {isEditing ? (
                                            <div className="space-y-2 pt-1">
                                                <textarea
                                                    value={editedReplyText}
                                                    onChange={(e) => setEditedReplyText(e.target.value)}
                                                    rows={3}
                                                    className="w-full bg-slate-900 border border-indigo-700/60 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 leading-relaxed"
                                                    placeholder="Nhập nội dung phản hồi mới..."
                                                />
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={handleCancelEditing}
                                                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-md transition flex items-center gap-1 cursor-pointer"
                                                    >
                                                        <X size={12} /> Hủy
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSaveEditing(emailId)}
                                                        className="px-2.5 py-1 bg-indigo-700 hover:bg-indigo-600 text-white text-xs rounded-md transition flex items-center gap-1 cursor-pointer"
                                                    >
                                                        <Check size={12} /> Lưu thay đổi
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                                <p className="text-xs text-indigo-200 leading-relaxed italic">
                                                    "{email.suggestedReply}"
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={() => handleSendReply(email)}
                                                    disabled={isSending}
                                                    className="shrink-0 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                                                >
                                                    {isSending ? (
                                                        <>
                                                            <Loader2 size={13} className="animate-spin" /> Đang gửi...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Send size={12} /> {email.isAutoReplied ? 'Gửi lại' : 'Gửi phản hồi'}
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </main>
        </div>
    );
};