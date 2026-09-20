import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  googleTokens?: {
    accessToken?: string;
    refreshToken?: string;
  };
}

const UserSchema = new Schema<IUser>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String }, // Trống nếu đăng nhập qua Google OAuth2
  googleTokens: {
    accessToken: { type: String },
    refreshToken: { type: String },
  },
}, { timestamps: true });

export default mongoose.model<IUser>('User', UserSchema);