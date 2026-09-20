export interface EmailItem {
    _id: string;
    messageId: string;
    sender: {
        name: string;
        email: string;
    };
    subject: string;
    bodyText: string;
    receivedAt: string;
    aiCategory: 'Customer Support' | 'Sales / Lead' | 'Internal Notice' | 'Work / Project' | 'Spam / Promo' | 'Phishing' | 'Unclassified';
    isPhishing: boolean;
    phishingReason?: string;
    isSpamOrPromo: boolean;
    priorityScore: number;
    priorityReason?: string;
    aiSummary: string;
    suggestedReply?: string;
    status: 'Pending' | 'Resolved' | 'SpamTrash';
    isAutoReplied: boolean;
}