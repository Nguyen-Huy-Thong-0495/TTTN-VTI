import mongoose, { Schema, Document, Model } from 'mongoose';

// TypeScript Interface
export interface IEmail extends Document {
    messageId: string;
    sender: {
        name: string;
        email: string;
    };
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
    userId: mongoose.Types.ObjectId; 
    createdAt?: Date;
    updatedAt?: Date;
}

// Mongoose 
const EmailSchema = new Schema<IEmail>(
    {
        messageId: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            index: true 
        },
        sender: {
            name: { type: String, required: true, trim: true },
            email: { type: String, required: true, trim: true, lowercase: true }
        },
        subject: { type: String, required: true, trim: true },
        bodyText: { type: String, required: true },
        receivedAt: { type: Date, default: Date.now },
        aiCategory: { type: String, default: 'Unclassified', trim: true },
        isPhishing: { type: Boolean, default: false },
        phishingReason: { type: String, trim: true },
        isSpamOrPromo: { type: Boolean, default: false },
        priorityScore: {
            type: Number,
            default: 0,
            min: 0,
            max: 10 
        },
        priorityReason: { type: String, trim: true },
        aiSummary: { type: String, default: '', trim: true },
        suggestedReply: { type: String, trim: true },
        status: {
            type: String,
            enum: ['Pending', 'Resolved', 'SpamTrash'],
            default: 'Pending',
            index: true
        },
        isAutoReplied: { type: Boolean, default: false },
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        }
    },
    {
        timestamps: true, 
        versionKey: false 
    }
);

// Tối ưu Đánh chỉ mục kép 
// Giúp câu lệnh truy vấn email theo User và sắp xếp thời gian mới nhất chạy mượt hơn khi Polling
EmailSchema.index({ userId: 1, receivedAt: -1 });
EmailSchema.index({ userId: 1, status: 1 });

// Export Model (Khắc phục lỗi OverwriteModelError khi Nodemon / TS-Node-Dev hot-reload)
const Email: Model<IEmail> = mongoose.models.Email || mongoose.model<IEmail>('Email', EmailSchema);

export default Email;