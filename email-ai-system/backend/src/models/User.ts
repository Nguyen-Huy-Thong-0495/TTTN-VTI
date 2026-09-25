import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  role: 'admin' | 'user';
  tokenLimit: number;
  tokensUsed: number;
  googleTokens?: {
    accessToken?: string;
    refreshToken?: string;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

const UserSchema = new Schema<IUser>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  role: { 
    type: String, 
    enum: ['admin', 'user'], 
    default: 'user' // Mặc định là tài khoản user thường
  },
  tokenLimit: { 
    type: Number, 
    default: 10000 // Hạn mức token mặc định
  },
  tokensUsed: { 
    type: Number, 
    default: 0 // Số token đã sử dụng
  },
  googleTokens: {
    accessToken: { type: String },
    refreshToken: { type: String },
  },
}, { timestamps: true });

export default mongoose.model<IUser>('User', UserSchema);