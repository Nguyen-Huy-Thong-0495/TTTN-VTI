import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import User from '../models/User';

// Mở rộng Request để lấy userId từ Middleware xác thực (Auth Middleware)
interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}

/**
 * Đăng ký tài khoản mới
 */
export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Vui lòng nhập đầy đủ thông tin.' });
    }

    // Kiểm tra email đã tồn tại chưa
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email này đã được sử dụng.' });
    }

    // Mã hóa mật khẩu
    const hashedPassword = await bcrypt.hash(password, 10);

    // Tạo User mới (role, tokenLimit, tokensUsed, emailConfig lấy giá trị mặc định từ Model)
    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    // Tạo JWT Token (bổ sung role vào payload)
    const token = jwt.sign(
      { id: newUser._id, role: newUser.role },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Đăng ký thành công!',
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        tokenLimit: newUser.tokenLimit,
        tokensUsed: newUser.tokensUsed,
        emailConfig: newUser.emailConfig
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi máy chủ khi đăng ký', error });
  }
};

/**
 * Đăng nhập
 */
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Vui lòng nhập email và mật khẩu.' });
    }

    // Kiểm tra user có tồn tại không
    const user = await User.findOne({ email });
    if (!user || !user.password) {
      return res.status(400).json({ message: 'Email hoặc mật khẩu không chính xác.' });
    }

    // So sánh mật khẩu
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Email hoặc mật khẩu không chính xác.' });
    }

    // Tạo JWT Token (bổ sung role vào payload)
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '7d' }
    );

    res.status(200).json({
      message: 'Đăng nhập thành công!',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        tokenLimit: user.tokenLimit,
        tokensUsed: user.tokensUsed,
        emailConfig: user.emailConfig
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi máy chủ khi đăng nhập', error });
  }
};

/**
 * Cập nhật cấu hình Email (Mật khẩu ứng dụng App Password)
 */
export const updateEmailConfig = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { emailAddress, appPassword } = req.body;

    if (!emailAddress || !appPassword) {
      return res.status(400).json({ message: 'Vui lòng nhập đầy đủ Email và Mật khẩu ứng dụng.' });
    }

    // Loại bỏ khoảng trắng thừa nếu người dùng dán chuỗi kiểu "xxxx xxxx xxxx xxxx"
    const cleanedAppPassword = appPassword.replace(/\s+/g, '');

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        emailConfig: {
          emailAddress: emailAddress.trim(),
          appPassword: cleanedAppPassword,
          isConnected: true,
        },
      },
      { new: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
    }

    res.status(200).json({
      message: 'Lưu cấu hình hòm thư thành công!',
      emailConfig: updatedUser.emailConfig,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi máy chủ khi cập nhật cấu hình email', error });
  }
};

/**
 * Lấy thông tin cấu hình Email hiện tại của User
 */
export const getEmailConfig = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const user = await User.findById(userId).select('emailConfig');

    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
    }

    res.status(200).json({
      emailConfig: user.emailConfig || { emailAddress: '', appPassword: '', isConnected: false },
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi máy chủ khi lấy cấu hình email', error });
  }
};

/**
 * Ngắt kết nối hòm thư
 */
export const disconnectEmail = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        'emailConfig.isConnected': false,
      },
      { new: true }
    ).select('-password');

    res.status(200).json({
      message: 'Đã ngắt kết nối hòm thư.',
      emailConfig: updatedUser?.emailConfig,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi máy chủ khi ngắt kết nối email', error });
  }
};

/**
 * 1. Chuyển hướng người dùng sang trang đăng nhập Google
 */
export const googleAuth = (req: Request, res: Response) => {
  const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  const options = {
    redirect_uri: process.env.GOOGLE_REDIRECT_URI as string,
    client_id: process.env.GOOGLE_CLIENT_ID as string,
    access_type: 'offline',
    response_type: 'code',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send'
    ].join(' '),
  };

  const qs = new URLSearchParams(options);
  res.redirect(`${rootUrl}?${qs.toString()}`);
};

///2. Xử lý Callback khi Google trả về mã xác thực

export const googleAuthCallback = async (req: Request, res: Response) => {
  const code = req.query.code as string;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  if (!code) {
    return res.redirect(`${frontendUrl}/login?error=NoCodeProvided`);
  }

  try {
    // Đổi code lấy Access Token và Refresh Token từ Google
    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const values = {
      code,
      client_id: process.env.GOOGLE_CLIENT_ID as string,
      client_secret: process.env.GOOGLE_CLIENT_SECRET as string,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI as string,
      grant_type: 'authorization_code',
    };

    const tokenRes = await axios.post(tokenUrl, new URLSearchParams(values), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const { access_token, refresh_token } = tokenRes.data;

    // Lấy thông tin profile của user từ Google
    const userRes = await axios.get(
      `https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${access_token}`,
      { headers: { Authorization: `Bearer ${access_token}` } }
    );

    const { email, name } = userRes.data;

    // Tìm hoặc tạo mới User trong MongoDB và LƯU GOOGLE TOKENS
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        name,
        email,
        password: '',
        googleTokens: {
          accessToken: access_token,
          refreshToken: refresh_token || ''
        },
        emailConfig: {
          emailAddress: email,
          isConnected: true,
        }
      });
    } else {
      user.googleTokens = {
        accessToken: access_token,
        refreshToken: refresh_token || user.googleTokens?.refreshToken
      };
      user.emailConfig = {
        ...user.emailConfig,
        emailAddress: email,
        isConnected: true
      };
      await user.save();
    }

    // Tạo JWT Token riêng của hệ thống
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '7d' }
    );

    // Chuyển hướng về Frontend kèm theo token và thông tin user trên URL
    res.redirect(`${frontendUrl}/login?token=${token}&user=${encodeURIComponent(JSON.stringify({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      tokenLimit: user.tokenLimit,
      tokensUsed: user.tokensUsed,
      emailConfig: user.emailConfig
    }))}`);

  } catch (error) {
    console.error('Google Auth Callback Error:', error);
    res.redirect(`${frontendUrl}/login?error=GoogleAuthFailed`);
  }
};