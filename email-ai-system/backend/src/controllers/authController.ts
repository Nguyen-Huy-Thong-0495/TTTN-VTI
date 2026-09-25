import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User';

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

    // Tạo User mới (role, tokenLimit, tokensUsed lấy giá trị mặc định từ Model)
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
        tokensUsed: newUser.tokensUsed
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
        tokensUsed: user.tokensUsed
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi máy chủ khi đăng nhập', error });
  }
};