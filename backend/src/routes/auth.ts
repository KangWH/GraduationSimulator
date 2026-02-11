import express, { type Request, type Response } from 'express';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from '../generated/prisma/client.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { JWT_SECRET, authenticate } from '../middleware/auth.js';

const adapter = new PrismaPg({ connectionString: process.env["DATABASE_URL"] ?? '' })
const prisma = new PrismaClient({ adapter });
const router = express.Router();

router.get('/check-email', async (req: Request, res: Response) => {
  try {
    const email = req.query.email as string;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        message: '이메일을 입력해주세요.',
      });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: '올바른 이메일 형식이 아닙니다.',
      });
    }
    const existingUser = await prisma.user.findUnique({
      where: { email: email.trim() },
    });
    return res.json({
      success: true,
      available: !existingUser,
    });
  } catch (err) {
    console.error('check-email error:', err);
    return res.status(500).json({
      success: false,
      message: '이메일 확인 중 오류가 발생했습니다.',
    });
  }
});

router.post('/signup', async (req: Request, res: Response) => {
  try {
    const {
      email,
      password,
      profile,
      enrollments,
    } = req.body;

    // 이메일과 비밀번호 검증
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: '이메일과 비밀번호를 모두 입력해주세요.',
      });
    }

    // 이메일 형식 검증 (간단한 검증)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: '올바른 이메일 형식이 아닙니다.',
      });
    }

    // 비밀번호 길이 검증
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: '비밀번호는 최소 6자 이상이어야 합니다.',
      });
    }

    // 프로필 필수 필드 검증 (profile이 있으면)
    if (profile) {
      const { name, studentId, admissionYear, major } = profile;
      if (!name || !studentId || !admissionYear || !major) {
        return res.status(400).json({
          success: false,
          message: '필수 정보(이름, 학번, 입학연도, 전공)를 모두 입력해주세요.',
        });
      }
      if (admissionYear < 2016) {
        return res.status(400).json({
          success: false,
          message: '2016년 및 그 이후 입학생만 가입할 수 있습니다.',
        });
      }
    }

    // 이메일 중복 체크
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: '이미 사용 중인 이메일입니다.',
      });
    }

    // 학번 중복 체크 (profile이 있으면)
    if (profile?.studentId) {
      const existingProfile = await prisma.profile.findUnique({
        where: { studentId: profile.studentId },
      });
      if (existingProfile) {
        return res.status(409).json({
          success: false,
          message: '이미 사용 중인 학번입니다.',
        });
      }
    }

    // 비밀번호 해싱
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 수강 내역 (profile과 함께 전달된 경우)
    let enrollmentsJson: unknown = [];
    if (Array.isArray(enrollments)) {
      enrollmentsJson = enrollments;
    } else if (typeof enrollments === 'string') {
      try {
        enrollmentsJson = JSON.parse(enrollments);
      } catch {
        enrollmentsJson = [];
      }
    }
    if (!Array.isArray(enrollmentsJson)) {
      enrollmentsJson = [];
    }

    if (profile) {
      // User + Profile 동시 생성
      const doubleMajorsArray = Array.isArray(profile.doubleMajor) ? profile.doubleMajor : profile.doubleMajor ? [profile.doubleMajor] : [];
      const minorsArray = Array.isArray(profile.minor) ? profile.minor : profile.minor ? [profile.minor] : [];
      const validDoubleMajors = doubleMajorsArray.filter((v: unknown) => v && typeof v === 'string' && (v as string).trim() !== '' && v !== 'none');
      const validMinors = minorsArray.filter((v: unknown) => v && typeof v === 'string' && (v as string).trim() !== '' && v !== 'none');

      const newUser = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          profile: {
            create: {
              name: profile.name,
              studentId: profile.studentId,
              admissionYear: parseInt(profile.admissionYear.toString()),
              isFallAdmission: profile.isFallAdmission || false,
              major: profile.major,
              doubleMajors: validDoubleMajors,
              minors: validMinors,
              advancedMajor: profile.advancedMajor || false,
              individuallyDesignedMajor: profile.individuallyDesignedMajor || false,
              enrollments: enrollmentsJson as Prisma.InputJsonValue,
            },
          },
        },
      });

      res.status(201).json({
        success: true,
        message: '회원가입이 완료되었습니다. 로그인해주세요.',
        user: {
          id: newUser.id,
          email: newUser.email,
        },
      });
    } else {
      // 기존 방식: User만 생성
      const newUser = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
        },
      });

      res.status(201).json({
        success: true,
        message: '회원가입이 완료되었습니다.',
        user: {
          id: newUser.id,
          email: newUser.email,
        },
      });
    }
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.',
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

    // JWT 토큰 생성
    const token = jwt.sign(
      { userId: user.id },
      JWT_SECRET,
      { expiresIn: '7d' } // 7일 유효
    );

    // HTTP-only 쿠키로 토큰 설정
    res.cookie('token', token, {
      httpOnly: true, // JavaScript에서 접근 불가 (XSS 방지)
      secure: process.env.NODE_ENV === 'production', // HTTPS에서만 전송 (프로덕션)
      sameSite: 'lax', // CSRF 방지
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
      path: '/',
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

// 로그아웃
router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
  res.status(200).json({ success: true, message: '로그아웃되었습니다.' });
});

// 현재 사용자 정보 조회 (쿠키 기반)
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: '인증이 필요합니다.' });
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    if (!user) {
      return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
    }
    res.status(200).json({ success: true, user: { id: user.id, email: user.email } });
  } catch (error) {
    console.error('Me error:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

router.post('/change-password', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: '인증이 필요합니다.' });
    }
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: '현재 비밀번호와 새 비밀번호를 입력해주세요.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: '새 비밀번호는 최소 6자 이상이어야 합니다.' });
    }
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
    }
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      return res.status(401).json({ success: false, message: '현재 비밀번호가 일치하지 않습니다.' });
    }
    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: userId }, data: { password: hashed } });
    res.status(200).json({ success: true, message: '비밀번호가 변경되었습니다.' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

router.post('/delete-account', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: '인증이 필요합니다.' });
    }
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ success: false, message: '비밀번호를 입력해주세요.' });
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user) {
      return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ success: false, message: '비밀번호가 일치하지 않습니다.' });
    }
    if (user.profile) {
      await prisma.profile.delete({ where: { userId: user.id } });
    }
    await prisma.user.delete({ where: { id: userId } });
    
    // 쿠키 삭제
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
    
    res.status(200).json({ success: true, message: '회원 탈퇴가 완료되었습니다.' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

export default router;
