import mongoose, { Schema, Document } from 'mongoose';

export interface IEmail extends Document {
    messageId: string;
    sender: { name: string; email: string };
    subject: string;
    bodyText: string;
    receivedAt: Date;
    aiCategory: string;
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

const EmailSchema: Schema = new Schema(
    {
        messageId: { type: String, required: true, unique: true },
        sender: {
            name: { type: String, required: true },
            email: { type: String, required: true },
        },
        subject: { type: String, required: true },
        bodyText: { type: String, required: true },
        receivedAt: { type: Date, default: Date.now },
        aiCategory: { type: String, default: 'Unclassified' },
        isPhishing: { type: Boolean, default: false },
        phishingReason: { type: String },
        isSpamOrPromo: { type: Boolean, default: false },
        priorityScore: { type: Number, default: 0 },
        priorityReason: { type: String },
        aiSummary: { type: String, default: '' },
        suggestedReply: { type: String },
        status: { type: String, enum: ['Pending', 'Resolved', 'SpamTrash'], default: 'Pending' },
        isAutoReplied: { type: Boolean, default: false },
    },
    { timestamps: true }
);

export default mongoose.model<IEmail>('Email', EmailSchema);