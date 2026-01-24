import express, { type Request, type Response } from 'express';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import bcrypt from 'bcryptjs';

const adapter = new PrismaPg({ connectionString: process.env["DATABASE_URL"] ?? '' })
const prisma = new PrismaClient({ adapter });
const router = express.Router();

router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // 이메일과 비밀번호 검증
    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        message: '이메일과 비밀번호를 모두 입력해주세요.' 
      });
    }

    // 이메일 형식 검증 (간단한 검증)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false,
        message: '올바른 이메일 형식이 아닙니다.' 
      });
    }

    // 비밀번호 길이 검증
    if (password.length < 6) {
      return res.status(400).json({ 
        success: false,
        message: '비밀번호는 최소 6자 이상이어야 합니다.' 
      });
    }

    // 이메일 중복 체크
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json({ 
        success: false,
        message: '이미 사용 중인 이메일입니다.' 
      });
    }

    // 비밀번호 해싱
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 사용자 생성
    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
      },
    });

    // 회원가입 성공
    res.status(201).json({
      success: true,
      message: '회원가입이 완료되었습니다.',
      user: {
        id: newUser.id,
        email: newUser.email,
      },
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ 
      success: false,
      message: '서버 오류가 발생했습니다.' 
    });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // 이메일과 비밀번호 검증
    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        message: '이메일과 비밀번호를 모두 입력해주세요.' 
      });
    }

    // 사용자 찾기
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: '이메일 또는 비밀번호가 올바르지 않습니다.' 
      });
    }

    // 비밀번호 검증
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false,
        message: '이메일 또는 비밀번호가 올바르지 않습니다.' 
      });
    }

    // Profile 존재 여부 확인
    const profile = await prisma.profile.findUnique({
      where: { userId: user.id },
    });

    // 로그인 성공
    res.status(200).json({
      success: true,
      message: '로그인 성공',
      user: {
        id: user.id,
        email: user.email,
      },
      hasProfile: !!profile,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false,
      message: '서버 오류가 발생했습니다.' 
    });
  }
});

export default router;
